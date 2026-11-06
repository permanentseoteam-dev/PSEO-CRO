"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { requestAccess } from "@/lib/modules/access/request";
import { startConversation } from "@/app/(app)/chat/actions";
import { pageTitleFrom } from "@/lib/modules/access/request-logic";
import s from "./access-help.module.css";

/** Admin list with Message buttons, plus the one Request access button. */
export function AccessHelp({ admins, canMessage }: { admins: { id: string; name: string }[]; canMessage: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const ask = () =>
    start(async () => {
      setError(null);
      const r = await requestAccess({ path, title: pageTitleFrom(document.title, path) });
      if (r.ok) setSent(true);
      else setError(r.error);
    });

  const message = (id: string) =>
    start(async () => {
      setError(null);
      const r = await startConversation({ memberIds: [id], text: "" });
      if (r.ok) router.push(`/chat?c=${r.id}`);
      else setError(r.error);
    });

  return (
    <div className={s.wrap}>
      {admins.length ? (
        <ul className={s.list}>
          {admins.map((a) => (
            <li key={a.id} className={s.row}>
              <Avatar name={a.name} size={30} />
              <span className={s.name}>{a.name}</span>
              {canMessage ? (
                <Button size="sm" onClick={() => message(a.id)} disabled={busy}>
                  Message
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="primary" onClick={ask} disabled={busy || sent}>
        {sent ? "Request sent" : "Request access"}
      </Button>
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
