import { Skeleton } from "@/components/ui/skeleton";

/**
 * The static shell for a storefront page: what a visitor sees while the profile streams in.
 *
 * Deliberately neutral — no theme colours — because the theme is only known once the
 * profile loads, and a flash of the wrong palette is worse than a brief neutral skeleton.
 */
export function StorefrontShell() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-12 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </main>
    </div>
  );
}

/** Shell for a single product page: cover, title, price, checkout block. */
export function ProductShell() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-10 flex flex-col gap-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="w-full aspect-video rounded-xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </main>
    </div>
  );
}
