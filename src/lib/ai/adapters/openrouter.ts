// OpenRouter (OpenAI-compatible) for Kimi and other open models.
//
// - JSON mode only (strict schemas aren't supported everywhere), with the schema spelled
//   out in the system prompt. generateStructured validates the answer and runs one repair.
// - Text only: PDFs are never sent here. Parse already sends the cleaned text.
// - Privacy: resume text is personal data. `provider.data_collection: "deny"` keeps
//   requests off upstream providers that store or train on prompts. OpenRouter is only
//   ever used when an AI_* env var names it; nothing defaults to it.
import OpenAI from 'openai'
import { modelInfo } from '@/lib/ai/models'
import { readChatCompletion } from '@/lib/ai/adapters/openai'
import type { Adapter, AdapterRequest } from '@/lib/ai/types'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export function schemaInstructions(schema: unknown): string {
  return `\n\nRespond with a single JSON object and nothing else (no markdown, no code fences). It must match this JSON schema exactly: every listed property present, no others.\n${JSON.stringify(schema)}`
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildOpenRouterRequest(req: AdapterRequest): Record<string, any> {
  const info = modelInfo(req.model, 'openrouter')
  return {
    model: req.model,
    ...(info.temperature && req.temperature !== undefined ? { temperature: req.temperature } : {}),
    max_tokens: req.maxTokens,
    response_format: { type: 'json_object' },
    provider: { data_collection: 'deny' },
    messages: [{ role: 'system', content: req.system + schemaInstructions(req.schema) }, ...req.messages.map((m) => ({ role: m.role, content: m.content }))],
  }
}

let defaultClient: OpenAI | null = null
export function openRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')
  defaultClient ??= new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_BASE_URL,
    defaultHeaders: { 'X-Title': 'ReWork', ...(process.env.NEXTAUTH_URL ? { 'HTTP-Referer': process.env.NEXTAUTH_URL } : {}) },
  })
  return defaultClient
}

export const openRouterAdapter: Adapter = {
  provider: 'openrouter',
  async call(req, client) {
    const c = (client ?? openRouterClient()) as any
    const completion = await c.chat.completions.create(buildOpenRouterRequest(req))
    return readChatCompletion(completion, req.model)
  },
}
