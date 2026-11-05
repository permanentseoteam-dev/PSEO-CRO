import { SkeletonCards, SkeletonPage, SkeletonPageHeader, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={1} />
      <SkeletonToolbar n={1} />
      <SkeletonCards n={6} lines={3} />
    </SkeletonPage>
  );
}
