import { SkeletonPage, SkeletonPageHeader, SkeletonTable, SkeletonTabs, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs n={4} />
      <SkeletonToolbar n={3} />
      <SkeletonTable rows={8} cols={6} />
    </SkeletonPage>
  );
}
