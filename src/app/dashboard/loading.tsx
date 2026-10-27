export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-2 border-b border-border/70 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-64 bg-muted rounded" />
          <div className="h-4 w-96 bg-muted/60 rounded" />
        </div>
        <div className="h-9 w-32 bg-muted rounded" />
      </div>

      {/* Metric Cards Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-border/80 bg-card/60 p-4 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="size-4 bg-muted rounded" />
            </div>
            <div className="h-7 w-20 bg-muted/80 rounded" />
            <div className="h-3 w-32 bg-muted/50 rounded" />
          </div>
        ))}
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-80 rounded-xl border border-border/80 bg-card/60 p-6 space-y-4">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted/60 rounded" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="size-5 rounded-full bg-muted shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-80 rounded-xl border border-border/80 bg-card/60 p-6 space-y-4">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-3 w-56 bg-muted/60 rounded" />
          <div className="space-y-3 pt-4">
            <div className="h-14 rounded-lg bg-muted/40 border border-border/40" />
            <div className="h-14 rounded-lg bg-muted/40 border border-border/40" />
            <div className="h-16 rounded-lg bg-muted/40 border border-border/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
