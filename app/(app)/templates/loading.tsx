import { SkeletonCards, SkeletonPage, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={1} />
      <SkeletonCards n={6} lines={3} />
    </SkeletonPage>
  );
}
