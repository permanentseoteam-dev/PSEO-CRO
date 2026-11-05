import { SkeletonPage, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={1} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonPage>
  );
}
