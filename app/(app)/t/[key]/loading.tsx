import { SkeletonPage, SkeletonPageHeader, SkeletonPanel, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonPageHeader actions={2} />
      <SkeletonToolbar n={2} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="stack gap-4">
          <SkeletonPanel lines={5} />
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={6} />
        </div>
        <div className="stack gap-4">
          <SkeletonPanel lines={8} />
          <SkeletonPanel lines={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
