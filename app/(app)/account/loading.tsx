import { Skeleton, SkeletonPage, SkeletonPageHeader, SkeletonPanel } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={0} />
      <div className="grid items-start gap-4 min-[901px]:grid-cols-[200px_minmax(0,880px)] min-[901px]:gap-8">
        <div className="flex gap-2 overflow-hidden min-[901px]:flex-col min-[901px]:gap-3 min-[901px]:px-3 min-[901px]:pt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} w={i % 2 ? 110 : 140} h={14} className="shrink-0" />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <SkeletonPanel lines={5} />
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
