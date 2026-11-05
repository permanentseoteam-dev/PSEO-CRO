import { SkeletonCards, SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonStats, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonStats n={5} />
      <SkeletonCards n={6} lines={3} />
      <div className="grid-2">
        <SkeletonTable rows={5} cols={3} />
        <SkeletonPanel lines={5} />
      </div>
    </SkeletonPage>
  );
}
