import { SkeletonPage, SkeletonPanel, SkeletonStats, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPanel lines={3} />
      <SkeletonStats n={4} />
      <div className="grid-2">
        <SkeletonPanel lines={5} />
        <SkeletonPanel lines={5} />
      </div>
      <div className="grid-2">
        <SkeletonPanel lines={4} />
        <SkeletonPanel lines={4} />
      </div>
      <SkeletonTable rows={5} cols={4} />
    </SkeletonPage>
  );
}
