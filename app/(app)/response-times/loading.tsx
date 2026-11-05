import { SkeletonPage, SkeletonPageHeader, SkeletonStats, SkeletonTable, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={1} />
      <SkeletonStats n={6} />
      <SkeletonTabs n={4} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonPage>
  );
}
