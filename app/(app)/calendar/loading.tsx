import { Skeleton, SkeletonPage, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <Skeleton h="min(65vh, 560px)" r="var(--radius-card)" />
    </SkeletonPage>
  );
}
