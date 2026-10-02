// OpenAI chat completions: json_schema strict output, PDF as a file input part.
// This is the behavior the app had before the provider layer, unchanged.
import OpenAI from 'openai'
import { modelInfo } from '@/lib/ai/models'
import type { Adapter, AdapterRequest, AdapterResult } from '@/lib/ai/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function buildOpenAIRequest(req: AdapterRequest): Record<string, any> {
  const info = modelInfo(req.model, 'openai')
  const messages: any[] = [{ role: 'system', content: req.system }]
  req.messages.forEach((m, i) => {
    if (i !== 0 || m.role !== 'user' || req.files.length === 0) {
      messages.push({ role: m.role, content: m.content })
      return
    }
    messages.push({
      role: 'user',
      content: [
        ...req.files.map((f) => ({
          type: 'file',
          file: { filename: f.filename, file_data: `data:application/pdf;base64,${f.data.toString('base64')}` },
        })),
        { type: 'text', text: m.content },
      ],
    })
  })
  return {
    model: req.model,
    ...(info.temperature && req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(info.maxCompletionTokens ? { max_completion_tokens: req.maxTokens * 2 } : { max_tokens: req.maxTokens }),
    response_format: { type: 'json_schema', json_schema: { name: req.schemaName, strict: true, schema: req.schema } },
    messages,
  }
}

/** Shared by OpenAI and OpenRouter (same response shape). */
export function readChatCompletion(completion: any, fallbackModel: string): AdapterResult {
  const choice = completion?.choices?.[0]
  const prompt = completion?.usage?.prompt_tokens ?? 0
  const cached = completion?.usage?.prompt_tokens_details?.cached_tokens ?? 0
  return {
    text: choice?.message?.content ?? '',
    stop: choice?.message?.refusal ? 'refusal' : choice?.finish_reason === 'length' ? 'length' : 'stop',
    model: completion?.model || fallbackModel,
    usage: { inputTokens: Math.max(0, prompt - cached), outputTokens: completion?.usage?.completion_tokens ?? 0, cachedInputTokens: cached },
  }
}

let defaultClient: OpenAI | null = null
export function openAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  defaultClient ??= new OpenAI({ apiKey })
  return defaultClient
}

export const openAIAdapter: Adapter = {
  provider: 'openai',
  async call(req, client) {
    const c = (client ?? openAIClient()) as any
    const completion = await c.chat.completions.create(buildOpenAIRequest(req))
    return readChatCompletion(completion, req.model)
  },
}
