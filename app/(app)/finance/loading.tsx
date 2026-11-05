import { SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonStats, SkeletonTable, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonToolbar n={3} />
      <SkeletonStats n={4} />
      <SkeletonStats n={4} />
      <div className="grid-2">
        <SkeletonPanel lines={6} />
        <SkeletonPanel lines={6} />
      </div>
      <div className="grid-3">
        <SkeletonTable rows={5} cols={2} />
        <SkeletonTable rows={5} cols={2} />
        <SkeletonTable rows={5} cols={2} />
      </div>
    </SkeletonPage>
  );
}
