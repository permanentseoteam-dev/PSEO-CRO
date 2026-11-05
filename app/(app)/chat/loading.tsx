import { Skeleton, SkeletonPage, SkeletonPanel } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="max-md:hidden">
          <SkeletonPanel lines={10} avatar />
        </div>
        <Skeleton h="calc(100dvh - 180px)" r="var(--radius-card)" />
      </div>
    </SkeletonPage>
  );
}
