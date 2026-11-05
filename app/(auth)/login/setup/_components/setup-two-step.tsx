"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { TwoStep } from "@/app/(app)/settings/_components/two-step";

export function SetupTwoStep({ home }: { home: string }) {
  const router = useRouter();
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>Set up 2-step sign-in</h1>
        <p className="muted">Your admin requires 2-step sign-in for your role. Set it up to continue.</p>
      </div>
      <TwoStep required onEnabled={() => router.replace(home)} />
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
