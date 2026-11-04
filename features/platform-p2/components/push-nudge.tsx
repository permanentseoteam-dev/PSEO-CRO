"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, CardBody } from "@/components/ui";

const KEY = "pp2-push-nudge-dismissed";
const SNOOZE_DAYS = 14;

/**
 * Home nudge to turn on phone/browser alerts. Shows only when the browser supports notifications,
 * permission hasn't been decided yet, and the person hasn't said "Not now" in the last 14 days.
 * The button goes to Settings → Phone alerts, where the chat-p2 PushToggle does the subscribing.
 */
export function PushNudge({ href = "/settings#push" }: { href?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    const at = Number(localStorage.getItem(KEY) ?? 0);
    // Reading browser-only state after mount is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Date.now() - at > SNOOZE_DAYS * 86400000) setShow(true);
  }, []);

  if (!show) return null;
  return (
    <Card>
      <CardBody className="between row">
        <div className="min-w-0">
          <strong>Get alerts on this device</strong>
          <div className="small muted">Ticket mentions, due dates and meeting reminders, even when the portal is closed.</div>
        </div>
        <div className="row">
          <ButtonLink variant="primary" href={href}>Turn on notifications</ButtonLink>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.setItem(KEY, String(Date.now()));
              setShow(false);
            }}
          >
            Not now
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
