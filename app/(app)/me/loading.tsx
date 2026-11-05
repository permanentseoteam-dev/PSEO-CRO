import { SkeletonPage, SkeletonPanel, SkeletonTabs } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel lines={2} avatar />
      <SkeletonTabs n={5} />
      <div className="grid-2">
        <div className="stack gap-4">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={4} />
        </div>
        <div className="stack gap-4">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={4} />
        </div>
      </div>
    </SkeletonPage>
  );
}
