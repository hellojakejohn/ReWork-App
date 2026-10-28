import type { ProviderId, TokenUsage } from '@/lib/ai/models'
import type { AITask, ModelRoute } from '@/lib/ai/routing'

export type JsonSchema = Record<string, unknown>

export interface AIFile {
  kind: 'pdf'
  data: Buffer
  filename: string
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

// Injected SDK clients (tests, the eval). Typed loosely so mocks only need the one method
// an adapter calls: anthropic.beta.messages.create, openai/openrouter.chat.completions.create.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProviderClients {
  anthropic?: any
  openai?: any
  openrouter?: any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface StructuredRequest {
  task: AITask
  system: string // long and static: cached on Anthropic
  messages: AIMessage[]
  schema: JsonSchema
  schemaName: string
  files?: AIFile[] // attached to the first user message; dropped for text-only providers
  maxTokens: number // the answer's budget; adapters add thinking headroom where needed
  temperature?: number // sent only to models that accept it
  effort?: 'low' | 'medium' | 'high' // Anthropic thinking depth
  route?: ModelRoute // explicit route (eval, tests); otherwise resolveRoute(task, scope)
  clients?: ProviderClients
}

export interface StructuredResult<T> {
  data: T
  usage: TokenUsage
  model: string // as the provider reported it
  provider: ProviderId
  ms: number
  attempts: number // 1, or 2 when the repair retry ran
  costUsd: number
}

/** What one adapter call returns, before JSON parsing and validation. */
export interface AdapterResult {
  text: string
  stop: 'stop' | 'length' | 'refusal'
  model: string
  usage: TokenUsage
}

export interface AdapterRequest {
  model: string
  system: string
  messages: AIMessage[]
  files: AIFile[]
  schema: JsonSchema
  schemaName: string
  maxTokens: number
  temperature?: number
  effort?: 'low' | 'medium' | 'high'
}

export interface Adapter {
  provider: ProviderId
  call(req: AdapterRequest, client: unknown): Promise<AdapterResult>
}
