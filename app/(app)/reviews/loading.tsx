import { SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonStats, SkeletonTable, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs n={3} />
      <SkeletonStats n={4} />
      <div className="grid-2">
        <SkeletonPanel lines={5} />
        <SkeletonPanel lines={5} />
      </div>
      <SkeletonTable rows={6} cols={5} />
    </SkeletonPage>
  );
}
