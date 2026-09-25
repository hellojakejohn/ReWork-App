import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as cheerio from 'cheerio';
import { openai } from '@/lib/openai';
import { checkRateLimit, rateLimitResponseBody } from '@/lib/rate-limit';
import { FetchTimeoutError, ResponseTooLargeError, UnsafeUrlError, assertSafeUrl, safeFetch } from '@/lib/safe-fetch';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rate = checkRateLimit(`job-url:${session.user.id || session.user.email}`);
    if (!rate.allowed) {
      return NextResponse.json(rateLimitResponseBody(rate.retryAfterSeconds), {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) }
      });
    }

    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    // Validate URL format (http(s) only, no private/loopback/metadata hosts). safeFetch
    // re-checks every resolved IP at connect time and on each redirect.
    let validatedUrl: URL;
    try {
      validatedUrl = assertSafeUrl(url);
    } catch (error) {
      const message = error instanceof UnsafeUrlError ? error.message : 'Invalid URL format';
      return NextResponse.json({ error: message, success: false }, { status: 400 });
    }

    console.log('🌐 Fetching job posting from:', validatedUrl.href);

    // Check for sites that commonly block scraping
    const blockedDomains = [
      'indeed.com',
      'linkedin.com',
      'glassdoor.com',
      'monster.com',
      'ziprecruiter.com'
    ];

    const isBlockedSite = blockedDomains.some(domain =>
      validatedUrl.hostname.includes(domain)
    );

    if (isBlockedSite) {
      console.log('⚠️ Blocked site detected:', validatedUrl.hostname);
      return NextResponse.json({
        error: 'This site blocks automated access',
        details: 'Please copy and paste the job description manually. Most job sites like Indeed, LinkedIn, and Glassdoor prevent automated data extraction for security reasons.',
        success: false,
        isBlockedSite: true
      }, { status: 400 });
    }

    // Fetch the webpage
    let response;
    try {
      response = await safeFetch(validatedUrl.href, {
        maxRedirects: 3,
        timeoutMs: 8000,
        maxBytes: 2 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        return NextResponse.json({ error: 'That URL is not allowed', details: error.message, success: false }, { status: 400 });
      }
      if (error instanceof FetchTimeoutError) {
        return NextResponse.json({ error: 'The job page took too long to respond', details: 'Please paste the job description manually.', success: false }, { status: 400 });
      }
      if (error instanceof ResponseTooLargeError) {
        return NextResponse.json({ error: 'The job page is too large to read', details: 'Please paste the job description manually.', success: false }, { status: 400 });
      }
      throw error;
    }

    if (response.status < 200 || response.status >= 300) {
      // Check if it's a bot detection/blocking response
      if (response.status === 403 || response.status === 429) {
        return NextResponse.json({
          error: 'This site blocks automated access',
          details: 'Please copy and paste the job description manually. The website has detected automated access and blocked it.',
          success: false,
          isBlockedSite: true
        }, { status: 400 });
      }
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = response.text;

    // Parse HTML with cheerio
    const $ = cheerio.load(html);

    // Remove script and style tags
    $('script').remove();
    $('style').remove();
    $('noscript').remove();

    // Extract text content - focus on body or main content area
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Try to find job content in common selectors
    let jobContent = '';

    // Common job posting selectors
    const contentSelectors = [
      '[class*="job-description"]',
      '[class*="job-details"]',
      '[class*="posting-description"]',
      '[id*="job-description"]',
      '[id*="job-details"]',
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 100) {
        jobContent = element.text();
        break;
      }
    }

    // Fallback to body text if no specific content found
    if (!jobContent) {
      jobContent = $('body').text();
    }

    // Clean up the text
    jobContent = jobContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 10000); // Limit to 10k chars

    console.log('📄 Extracted text length:', jobContent.length);

    // Use OpenAI to extract structured job data
    const prompt = `Extract job posting information from the following webpage content.

Page Title: ${title}
Meta Description: ${metaDescription}

Page Content:
${jobContent}

Extract and return this JSON structure with the ACTUAL data from the job posting:
{
  "jobTitle": "<actual job title>",
  "company": "<actual company name>",
  "location": "<actual job location>",
  "jobDescription": "<full job description including responsibilities, requirements, qualifications, benefits, etc.>"
}

Important:
- Extract the ACTUAL job title, company, and location from the content
- Include the FULL job description with all details
- If any field cannot be determined, use empty string ""
- Return valid JSON only`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a job posting parser. Extract accurate information from job postings and return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 3000,
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim();
    if (!aiResponse) {
      throw new Error('Empty response from AI');
    }

    // Parse the AI response
    const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
    const jobData = JSON.parse(cleanedResponse);

    console.log('✅ Job data extracted successfully:', {
      jobTitle: jobData.jobTitle?.substring(0, 50) + '...',
      company: jobData.company,
      location: jobData.location,
      descriptionLength: jobData.jobDescription?.length
    });

    return NextResponse.json({
      success: true,
      data: jobData
    });

  } catch (error) {
    console.error('❌ Job URL parsing error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to parse job posting',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}