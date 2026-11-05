import { SkeletonPage, SkeletonPageHeader, SkeletonTable, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={1} />
      <SkeletonToolbar n={1} />
      <SkeletonTable rows={10} cols={5} />
    </SkeletonPage>
  );
}
