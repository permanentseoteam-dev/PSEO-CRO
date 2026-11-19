import { SkeletonPage, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={0} />
      <SkeletonTable rows={6} cols={3} />
    </SkeletonPage>
  );
}
