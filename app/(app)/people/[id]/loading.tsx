import { SkeletonPage, SkeletonPanel, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel lines={2} avatar />
      <SkeletonTabs n={5} />
      <div className="grid-2">
        <SkeletonPanel lines={6} />
        <div className="stack gap-4">
          <SkeletonPanel lines={3} />
          <SkeletonPanel lines={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
