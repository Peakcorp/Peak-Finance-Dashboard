export function SkeletonText({ className = 'h-4 w-24' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonKPI() {
  return (
    <div className="card">
      <div className="skeleton mb-3 h-3 w-20" />
      <div className="skeleton h-7 w-28" />
    </div>
  )
}

export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className="card">
      <div className="skeleton mb-4 h-4 w-40" />
      <div className="skeleton w-full" style={{ height }} />
    </div>
  )
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="skeleton mb-4 h-4 w-40" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
