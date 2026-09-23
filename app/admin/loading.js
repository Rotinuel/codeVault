import { Skeleton, StatCardSkeleton } from "@/components/ui/Primitives";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-8 w-72 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 w-full rounded-2xl" />
    </div>
  );
}
