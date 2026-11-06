"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui";
import { mmss } from "@/lib/modules/portal/logic";
import { exitClientPreview } from "@/app/(app)/clients/preview-actions";
import s from "./portal-chrome.module.css";

/** Sticky staff banner during "See as client": who, read-only, time left, and Exit. Ends itself at 00:00. */
export function PreviewBanner({ clientId, clientName, exp }: { clientId: string; clientName: string; exp: number }) {
  const [left, setLeft] = useState(() => exp - Date.now());
  const [pending, start] = useTransition();
  const exit = () => start(() => exitClientPreview(clientId));

  useEffect(() => {
    const t = setInterval(() => setLeft(exp - Date.now()), 1000);
    return () => clearInterval(t);
  }, [exp]);

  const over = left <= 0;
  useEffect(() => {
    if (over) start(() => exitClientPreview(clientId));
  }, [over, clientId]);

  return (
    <div className={s.banner} role="status">
      <span className={s.who}>
        <Eye aria-hidden className={s.eye} />
        <span>
          Viewing as <b>{clientName}</b> · read-only
        </span>
      </span>
      <span className={s.end}>
        <span className={s.left}>
          Ends in{" "}
          <span className="num" suppressHydrationWarning>
            {mmss(left)}
          </span>
        </span>
        <Button size="sm" disabled={pending} onClick={exit}>
          Exit preview
        </Button>
      </span>
    </div>
  );
}
