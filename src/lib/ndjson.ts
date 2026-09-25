// Newline-delimited JSON progress streams. Long AI calls (parse, tailor) report real
// stages as they happen instead of the UI running a fake timer.
//
// Server: return ndjsonResponse(async (send) => { send({ type: 'stage', ... }); ... })
// Client: await readNdjson(response, (event) => ...)

export type StreamEvent<Stage extends string = string, Done = unknown> =
  | { type: 'stage'; stage: Stage }
  | { type: 'done'; result: Done }
  | { type: 'error'; status: number; error: string; [key: string]: unknown }

export function ndjsonResponse(run: (send: (event: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      try {
        await run(send)
      } catch (error) {
        console.error('[ndjson] stream handler failed:', error)
        send({ type: 'error', status: 500, error: 'Something went wrong. Please try again.' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}

/** Reads an NDJSON body, calling onEvent per line. Resolves when the stream ends. */
export async function readNdjson(response: Response, onEvent: (event: StreamEvent) => void): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) onEvent(JSON.parse(line) as StreamEvent)
    }
    if (done) break
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as StreamEvent)
}
