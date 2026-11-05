import { SkeletonPage, SkeletonPanel, SkeletonStats, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel lines={2} />
      <SkeletonTabs n={4} />
      <SkeletonStats n={4} />
      <SkeletonPanel lines={8} />
    </SkeletonPage>
  );
}
