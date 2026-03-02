export function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded-xl border border-slate-200/70 bg-slate-100/90"
        />
      ))}
    </div>
  );
}
