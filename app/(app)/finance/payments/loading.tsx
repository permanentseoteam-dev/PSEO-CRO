import { SkeletonPage, SkeletonPageHeader, SkeletonStats, SkeletonTable, SkeletonTabs, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs n={3} />
      <SkeletonToolbar n={2} />
      <SkeletonStats n={4} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonPage>
  );
}
