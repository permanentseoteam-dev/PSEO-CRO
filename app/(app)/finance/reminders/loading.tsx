import { SkeletonPage, SkeletonTable, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonTabs n={3} />
      <SkeletonTable rows={8} cols={5} />
    </SkeletonPage>
  );
}
