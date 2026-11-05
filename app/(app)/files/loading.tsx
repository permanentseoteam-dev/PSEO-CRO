import { Skeleton, SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <Skeleton h="var(--ctl-h)" />
      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <SkeletonPanel lines={8} />
        <SkeletonTable rows={8} cols={4} />
      </div>
    </SkeletonPage>
  );
}
