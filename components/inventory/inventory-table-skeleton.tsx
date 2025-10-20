import { Skeleton } from "@/components/ui/skeleton"

interface InventoryTableSkeletonProps {
  rows?: number
  columns?: number
}

export function InventoryTableSkeleton({ rows = 5, columns = 8 }: InventoryTableSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="flex items-center space-x-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center space-x-4 py-4">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-16" />
          ))}
        </div>
      ))}
    </div>
  )
}
