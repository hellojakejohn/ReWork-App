// The company boards the job feed reads (docs/job-feed-plan.md). Every one was checked live on
// 2026-11-08. Add freely: a board that stops answering is skipped and logged, never fatal.
import type { Board, WorkdayBoard } from './boards'

// Full lists, pulled daily by /api/cron/pull-jobs.
const GREENHOUSE = [
    'stripe', 'airbnb', 'figma', 'discord', 'coinbase', 'robinhood', 'dropbox', 'gitlab',
    'cloudflare', 'datadog', 'instacart', 'reddit', 'lyft', 'pinterest', 'twitch', 'duolingo',
    'asana', 'brex', 'chime', 'gusto', 'affirm', 'samsara', 'toast', 'squarespace', 'flexport',
    'andurilindustries', 'databricks', 'mongodb', 'elastic', 'okta', 'twilio', 'peloton',
    'sweetgreen', 'airtable', 'betterment', 'bitgo', 'blockchain', 'calendly', 'carta',
    'checkr', 'cockroachlabs', 'coursera', 'doximity', 'epicgames', 'faire', 'fivetran',
    'flatironhealth', 'gemini', 'glossier', 'hellofresh', 'honeycomb', 'intercom', 'justworks',
    'lattice', 'lucidmotors', 'medium', 'mercury', 'mixpanel', 'nextdoor', 'nuro', 'oscar',
    'pagerduty', 'ripple', 'roblox', 'rubrik', 'scaleai', 'seatgeek', 'sofi', 'sumologic',
    'tripadvisor', 'udemy', 'upstart', 'verkada', 'yext', 'zocdoc', 'block', 'taskrabbit',
    'everlane', 'mejuri', 'parachutehome', 'harrys', 'stitchfix', 'onemedical',
]
const LEVER = [
    'palantir', 'spotify', 'zoox', 'gopuff', 'jumpcloud', 'anchorage', 'ro', 'veeva', 'tala',
]
const ASHBY = [
    'ramp', 'notion', 'linear', 'openai', 'supabase', 'posthog', 'replit', 'cursor', 'ashby',
    'cohere', 'clickup', 'zapier', 'hex', 'modal', 'perplexity', 'elevenlabs', 'plaid',
    'snowflake', 'docker', 'benchling', 'watershed', 'quora', 'multiverse', 'harvey',
]

export const LIST_BOARDS: Board[] = [
  ...GREENHOUSE.map((slug) => ({ ats: 'greenhouse' as const, slug })),
  ...LEVER.map((slug) => ({ ats: 'lever' as const, slug })),
  ...ASHBY.map((slug) => ({ ats: 'ashby' as const, slug })),
]

// Big employers on Workday: thousands of jobs each, 20 per request, so they are searched by
// the person's target title when matching instead of pulled whole.
export const WORKDAY_BOARDS: WorkdayBoard[] = [
  { company: 'Target', tenant: 'target', host: 'target.wd5.myworkdayjobs.com', site: 'targetcareers' },
  { company: '3M', tenant: '3m', host: '3m.wd1.myworkdayjobs.com', site: 'Search' },
  { company: 'NVIDIA', tenant: 'nvidia', host: 'nvidia.wd5.myworkdayjobs.com', site: 'NVIDIAExternalCareerSite' },
  { company: 'Medtronic', tenant: 'medtronic', host: 'medtronic.wd1.myworkdayjobs.com', site: 'MedtronicCareers' },
  { company: 'U.S. Bank', tenant: 'usbank', host: 'usbank.wd1.myworkdayjobs.com', site: 'US_Bank_Careers' },
  { company: 'Ecolab', tenant: 'ecolab', host: 'ecolab.wd1.myworkdayjobs.com', site: 'Ecolab_External' },
  { company: 'Ameriprise Financial', tenant: 'ameriprise', host: 'ameriprise.wd5.myworkdayjobs.com', site: 'Ameriprise' },
  { company: 'Salesforce', tenant: 'salesforce', host: 'salesforce.wd12.myworkdayjobs.com', site: 'External_Career_Site' },
  { company: 'Intel', tenant: 'intel', host: 'intel.wd1.myworkdayjobs.com', site: 'External' },
  { company: 'Xcel Energy', tenant: 'xcelenergy', host: 'xcelenergy.wd1.myworkdayjobs.com', site: 'External' },
  { company: 'Adobe', tenant: 'adobe', host: 'adobe.wd5.myworkdayjobs.com', site: 'external_experienced' },
  { company: 'Workday', tenant: 'workday', host: 'workday.wd5.myworkdayjobs.com', site: 'Workday' },
  { company: 'Mastercard', tenant: 'mastercard', host: 'mastercard.wd1.myworkdayjobs.com', site: 'CorporateCareers' },
  { company: 'Capital One', tenant: 'capitalone', host: 'capitalone.wd12.myworkdayjobs.com', site: 'Capital_One' },
  { company: 'PNC', tenant: 'pnc', host: 'pnc.wd5.myworkdayjobs.com', site: 'External' },
  { company: 'CVS Health', tenant: 'cvshealth', host: 'cvshealth.wd1.myworkdayjobs.com', site: 'CVS_Health_Careers' },
  { company: 'Humana', tenant: 'humana', host: 'humana.wd5.myworkdayjobs.com', site: 'Humana_External_Career_Site' },
  { company: 'The Home Depot', tenant: 'homedepot', host: 'homedepot.wd5.myworkdayjobs.com', site: 'CareerDepot' },
  { company: "Lowe's", tenant: 'lowes', host: 'lowes.wd5.myworkdayjobs.com', site: 'LWS_External_CS' },
  { company: 'Nike', tenant: 'nike', host: 'nike.wd1.myworkdayjobs.com', site: 'nke' },
  { company: 'Disney', tenant: 'disney', host: 'disney.wd5.myworkdayjobs.com', site: 'disneycareer' },
  { company: 'AT&T', tenant: 'att', host: 'att.wd1.myworkdayjobs.com', site: 'ATTGeneral' },
  { company: 'Verizon', tenant: 'verizon', host: 'verizon.wd12.myworkdayjobs.com', site: 'verizon-careers' },
  { company: 'Pfizer', tenant: 'pfizer', host: 'pfizer.wd1.myworkdayjobs.com', site: 'PfizerCareers' },
  { company: 'Abbott', tenant: 'abbott', host: 'abbott.wd5.myworkdayjobs.com', site: 'abbottcareers' },
  { company: 'Cardinal Health', tenant: 'cardinalhealth', host: 'cardinalhealth.wd1.myworkdayjobs.com', site: 'EXT' },
  { company: 'PwC', tenant: 'pwc', host: 'pwc.wd3.myworkdayjobs.com', site: 'Global_Experienced_Careers' },
  { company: 'Accenture', tenant: 'accenture', host: 'accenture.wd103.myworkdayjobs.com', site: 'AccentureCareers' },
  { company: 'Boeing', tenant: 'boeing', host: 'boeing.wd1.myworkdayjobs.com', site: 'EXTERNAL_CAREERS' },
  // Added Nov 9 (non-tech: health care, retail, food, logistics, insurance; many in MN). Each
  // checked live. Not on public Workday search: Walmart, Comcast (422), Best Buy US, Target-style
  // own sites (UnitedHealth, Mayo, Fairview, HealthPartners, Cargill, Starbucks). Dropped: Chipotle
  // and Kohl's (places are store numbers), FedEx (that site is Latin America only).
  { company: 'Allina Health', tenant: 'allina', host: 'allina.wd5.myworkdayjobs.com', site: 'External', state: 'MN' },
  { company: 'Essentia Health', tenant: 'essentiahealth', host: 'essentiahealth.wd1.myworkdayjobs.com', site: 'Essentia_Health' },
  { company: 'Sanford Health', tenant: 'sanford', host: 'sanford.wd5.myworkdayjobs.com', site: 'SanfordHealth' },
  { company: 'Elevance Health', tenant: 'elevancehealth', host: 'elevancehealth.wd1.myworkdayjobs.com', site: 'ANT' },
  { company: 'Cigna', tenant: 'cigna', host: 'cigna.wd5.myworkdayjobs.com', site: 'cignacareers' },
  { company: 'McKesson', tenant: 'mckesson', host: 'mckesson.wd3.myworkdayjobs.com', site: 'External_Careers' },
  { company: 'Baxter', tenant: 'baxter', host: 'baxter.wd1.myworkdayjobs.com', site: 'baxter' },
  { company: 'Johnson & Johnson', tenant: 'jj', host: 'jj.wd5.myworkdayjobs.com', site: 'jj' },
  { company: 'Nordstrom', tenant: 'nordstrom', host: 'nordstrom.wd501.myworkdayjobs.com', site: 'nordstrom_careers' },
  { company: 'General Mills', tenant: 'genmills', host: 'genmills.wd1.myworkdayjobs.com', site: 'GMI_External_Careers' },
  { company: "Land O'Lakes", tenant: 'landolakes', host: 'landolakes.wd1.myworkdayjobs.com', site: 'landolakes' },
  { company: 'Sysco', tenant: 'sysco', host: 'sysco.wd5.myworkdayjobs.com', site: 'syscocareers' },
  { company: 'Polaris', tenant: 'polaris', host: 'polaris.wd5.myworkdayjobs.com', site: 'polarisjobs' },
  { company: 'C.H. Robinson', tenant: 'chrobinson', host: 'chrobinson.wd5.myworkdayjobs.com', site: 'chrobinson' },
  { company: 'Ryder', tenant: 'ryder', host: 'ryder.wd5.myworkdayjobs.com', site: 'rydercareers' },
  { company: 'J.B. Hunt', tenant: 'jbhunt', host: 'jbhunt.wd501.myworkdayjobs.com', site: 'Careers' },
  { company: 'Thrivent', tenant: 'thrivent', host: 'thrivent.wd5.myworkdayjobs.com', site: 'External' },
  { company: 'Travelers', tenant: 'travelers', host: 'travelers.wd5.myworkdayjobs.com', site: 'External' },
  { company: 'Wells Fargo', tenant: 'wf', host: 'wf.wd1.myworkdayjobs.com', site: 'WellsFargoJobs' },
  // Added Nov 14 (checked live). Skipped: Banner Health (places are hospital names, no state)
  // and Mosaic (mostly Brazil and Canada, towns without a state).
  { company: 'Graco', tenant: 'graco', host: 'graco.wd501.myworkdayjobs.com', site: 'graco_Careers' },
  { company: 'Pentair', tenant: 'pentair', host: 'pentair.wd5.myworkdayjobs.com', site: 'pentair_Careers' },
  { company: 'Prime Therapeutics', tenant: 'primetherapeutics', host: 'primetherapeutics.wd1.myworkdayjobs.com', site: 'primetherapeuticscareers' },
  { company: 'Werner Enterprises', tenant: 'werner', host: 'werner.wd501.myworkdayjobs.com', site: 'werner' },
]
