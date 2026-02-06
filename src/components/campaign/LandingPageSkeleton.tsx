import { Skeleton } from '@/components/ui/skeleton';

export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="relative min-h-[85svh] sm:min-h-[80vh] flex items-center justify-center bg-muted/30">
        <div className="text-center px-4 sm:px-6 max-w-4xl mx-auto py-12 space-y-6">
          <Skeleton className="h-10 sm:h-14 w-3/4 mx-auto" />
          <Skeleton className="h-6 sm:h-8 w-2/3 mx-auto" />
          <Skeleton className="h-12 w-48 mx-auto rounded-full" />
        </div>
      </div>

      {/* Benefits skeleton */}
      <div className="py-12 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Skeleton className="h-8 sm:h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-5 w-80 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-2xl p-6 space-y-4">
                <Skeleton className="w-14 h-14 rounded-xl mx-auto" />
                <Skeleton className="h-5 w-32 mx-auto" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form skeleton */}
      <div className="py-12 px-4 bg-muted/30">
        <div className="max-w-md mx-auto bg-card rounded-xl p-6 space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
