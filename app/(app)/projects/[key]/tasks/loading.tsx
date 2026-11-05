import { SkeletonPanel, SkeletonToolbar } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SkeletonToolbar n={2} />
      <SkeletonPanel lines={8} />
    </div>
  );
}
