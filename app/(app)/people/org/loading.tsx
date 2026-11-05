import { SkeletonCards, SkeletonPage, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonToolbar n={2} />
      <SkeletonCards n={6} lines={2} avatar />
    </SkeletonPage>
  );
}
