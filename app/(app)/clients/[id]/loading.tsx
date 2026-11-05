import { SkeletonPage, SkeletonPanel, SkeletonStats, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel lines={3} avatar />
      <SkeletonStats n={6} />
      <SkeletonTabs n={8} />
      <div className="grid-2">
        <SkeletonPanel lines={6} />
        <SkeletonPanel lines={6} />
      </div>
    </SkeletonPage>
  );
}
