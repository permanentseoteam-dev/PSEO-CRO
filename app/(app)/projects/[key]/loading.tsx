import { SkeletonCards, SkeletonPage, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader />
      <SkeletonCards n={3} lines={3} />
    </SkeletonPage>
  );
}
