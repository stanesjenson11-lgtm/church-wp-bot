import { cn } from "@/lib/utils";

/**
 * What a page looks like before its data arrives, shown the instant a link is
 * tapped (each is a route's loading.tsx). Shapes, not spinners: the eye lands
 * where the content will be, so the swap reads as arrival, not a jump.
 */

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-xl", className)} />;
}

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("tile flex flex-col gap-4 rounded-[28px] p-5", className)}>
      {children}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <Bone className="size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Bone className="h-3.5 w-32" />
        <Bone className="h-3 w-20" />
      </div>
      <Bone className="size-10 rounded-full" />
    </div>
  );
}

/** The dashboard's bento grid, card for card. */
export function BentoSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Bone className="h-10 w-72 max-w-full md:h-12" />
        <div className="flex gap-2">
          <Bone className="h-11 w-40 rounded-full" />
          <Bone className="h-11 w-36 rounded-full" />
        </div>
      </div>
      <div className="@container">
        <div className="grid grid-flow-row-dense gap-4 @3xl:grid-cols-2 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)_minmax(0,1.1fr)]">
          <Panel>
            <Header />
            <Bone className="h-44 rounded-[22px]" />
          </Panel>
          <Panel className="@3xl:col-start-1">
            <Bone className="h-3 w-24" />
            <Bone className="h-8 w-40" />
          </Panel>
          <Panel className="@3xl:row-span-2">
            <Header />
            <Bone className="min-h-60 flex-1 rounded-3xl" />
          </Panel>
          <Panel className="@3xl:col-span-2 @6xl:col-span-1 @6xl:row-span-2">
            <Header />
            <Bone className="mx-auto h-10 w-32" />
            <Bone className="min-h-44 flex-1 rounded-3xl" />
          </Panel>
          <Panel className="@3xl:col-span-2">
            <Header />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Bone className="size-9 rounded-full" />
                <Bone className="h-3.5 flex-1" />
                <Bone className="h-3.5 w-20" />
              </div>
            ))}
          </Panel>
          <Panel>
            <Header />
            <Bone className="h-12 w-24" />
            <Bone className="h-28 rounded-[20px]" />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** A list page: title and actions, then a table of rows. */
export function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-6 w-44" />
          <Bone className="h-3.5 w-28" />
        </div>
        <Bone className="h-9 w-32 rounded-full" />
      </div>
      <Panel className="gap-0 p-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Bone className="size-8 rounded-full" />
            <Bone className="h-3.5 w-1/3" />
            <Bone className="ml-auto h-3.5 w-1/5" />
          </div>
        ))}
      </Panel>
    </div>
  );
}

/** The staff screens: a heading over a few cards. */
export function StackSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-6 w-64 max-w-full" />
        <Bone className="h-3.5 w-40" />
      </div>
      {[0, 1].map((i) => (
        <Panel key={i}>
          <Header />
          <Bone className="h-3.5 w-full" />
          <Bone className="h-3.5 w-2/3" />
        </Panel>
      ))}
    </div>
  );
}
