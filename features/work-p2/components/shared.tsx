"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import type { Result } from "../types";

/** Runs a server action, shows its error (or `done`) as a toast, refreshes the page on success. */
export function useRun() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = <T,>(action: () => Promise<Result<T>>, done?: string, after?: (r: Result<T>) => void) =>
    start(async () => {
      const r = await action();
      if (!r.ok) {
        toast(r.error);
        return;
      }
      if (done) toast(done);
      after?.(r);
      router.refresh();
    });
  return { pending, run };
}
