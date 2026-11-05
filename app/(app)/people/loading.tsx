import { SkeletonCards, SkeletonPage, SkeletonPageHeader, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={0} />
      <SkeletonToolbar n={2} />
      <SkeletonCards n={9} lines={2} avatar />
    </SkeletonPage>
  );
}
