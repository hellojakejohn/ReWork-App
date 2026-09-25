// src/lib/openai.ts
import OpenAI from 'openai'

let client: OpenAI | null = null

/**
 * Created on first use so importing this module (and `next build`) works without env.
 * Every call site sets max_tokens (or max_completion_tokens) and calls recordUsage()
 * from src/lib/ai-usage.ts so the admin page can estimate spend.
 */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}
