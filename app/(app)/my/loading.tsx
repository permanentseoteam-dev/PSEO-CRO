import { SkeletonPage, SkeletonTable, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonToolbar n={2} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonPage>
  );
}
