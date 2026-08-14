import { NextResponse } from 'next/server'

// Wraps a route handler so any thrown error (including low-level network
// exceptions from an unreachable Supabase host) becomes a clean JSON 500
// instead of leaking a raw stack trace / exception message to the client.
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Unexpected server error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}
