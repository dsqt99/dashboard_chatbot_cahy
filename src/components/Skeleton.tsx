interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = '', lines = 1 }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div className={className}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton h-4 rounded mb-2"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }
  return <div className={`skeleton rounded ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </div>
  )
}

