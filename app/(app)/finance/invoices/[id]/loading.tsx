import { Skeleton, SkeletonPage, SkeletonPageHeader, SkeletonPanel } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={3} />
      <Skeleton h={44} r="var(--radius)" />
      <div className="grid-2">
        <SkeletonPanel lines={8} />
        <div className="stack gap-4">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={4} />
        </div>
      </div>
    </SkeletonPage>
  );
}
