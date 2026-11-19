import { SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonTable, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={0} />
      <SkeletonToolbar n={1} />
      <SkeletonPanel lines={4} />
      <SkeletonPanel lines={6} />
      <SkeletonTable rows={5} cols={3} />
    </SkeletonPage>
  );
}
