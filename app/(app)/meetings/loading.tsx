import { SkeletonPage, SkeletonPageHeader, SkeletonStats, SkeletonTable, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonStats n={5} />
      <SkeletonTabs n={3} />
      <SkeletonTable rows={6} cols={5} />
    </SkeletonPage>
  );
}
