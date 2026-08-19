// Supabase/PostgREST caps unpaginated selects at 1000 rows by default.
// This pages through with .range(), fetching several pages concurrently instead of one
// at a time — with tables in the tens of thousands of rows, sequential paging was slow
// enough to risk a serverless function timeout.
const PAGE_SIZE = 1000
const CONCURRENCY = 20

interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

export async function fetchAllRows<T>(
  buildQuery: () => RangeableQuery<T>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = []
  let from = 0
  while (true) {
    const starts = Array.from({ length: CONCURRENCY }, (_, i) => from + i * PAGE_SIZE)
    const results = await Promise.all(starts.map((start) => buildQuery().range(start, start + PAGE_SIZE - 1)))

    let hitEnd = false
    for (const { data, error } of results) {
      if (error) return { data: all, error }
      all.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) hitEnd = true
    }
    if (hitEnd) break
    from += CONCURRENCY * PAGE_SIZE
  }
  return { data: all, error: null }
}
