/** A loading placeholder that keeps the layout from jumping. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-box bg-line ${className}`} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-box border border-line bg-card p-4">
      <Skeleton className="mb-3 h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`mb-2 h-3 ${i % 2 ? "w-2/3" : "w-full"}`} />)}
    </div>
  );
}
