// A fake Anthropic client for tests: only `beta.messages.create`, the one method the
// adapter calls. Pass it as `{ client }` to any AI lib (callOverrides pins it to Anthropic).
import { vi } from 'vitest'

/** A finished Anthropic reply whose text is `text`. */
export function anthropicText(text: string, extra: Record<string, unknown> = {}) {
  return {
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    ...extra,
  }
}

/** A reply carrying `value` as JSON. */
export const anthropicJson = (value: unknown) => anthropicText(JSON.stringify(value))

/** `impl` runs for every call (throw from it to fake an API error). */
export function fakeAnthropic(impl: (body: Record<string, unknown>) => unknown) {
  const create = vi.fn(async (body: Record<string, unknown>) => impl(body))
  return { client: { beta: { messages: { create } } } as never, create }
}

/** The request body of call `n` (0-based). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bodyOf = (create: { mock: { calls: unknown[][] } }, n = 0) => create.mock.calls[n][0] as Record<string, any>
