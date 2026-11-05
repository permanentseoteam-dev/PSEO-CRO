"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { useToast } from "@/components/ui";
import { pushConfigured, subscribeThisDevice } from "@/features/chat-p2/components/push-toggle";
import css from "./push-prompt.module.css";

const KEY = "pp2-push-nudge-dismissed";
const SNOOZE_DAYS = 14;
const DELAY_MS = 1500;

/**
 * App-open prompt to turn on browser notifications. Shows only when the browser supports notifications,
 * permission hasn't been decided yet, and the person hasn't said "Not now" in the last 14 days.
 * Escape and a backdrop click count as "Not now".
 */
export function PushPrompt() {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) <= SNOOZE_DAYS * 86400000) return;
    const t = setTimeout(() => ref.current?.showModal(), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function notNow() {
    localStorage.setItem(KEY, String(Date.now()));
    ref.current?.close();
  }

  async function enable() {
    setPending(true);
    if (pushConfigured) {
      const r = await subscribeThisDevice();
      toast(r.ok ? "Notifications on for this device" : r.error);
    } else {
      const p = await Notification.requestPermission();
      toast(p === "granted" ? "Notifications allowed on this device" : p === "denied" ? "Notifications blocked in browser settings" : "Notifications not turned on");
    }
    setPending(false);
    ref.current?.close();
  }

  return (
    <dialog
      ref={ref}
      className={css.dialog}
      aria-labelledby="push-prompt-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) notNow();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) notNow();
      }}
    >
      <div className={css.card}>
        <div className={css.body}>
          <h2 id="push-prompt-title" className={css.title}>
            <BellRing className={css.icon} aria-hidden="true" />
            Browser notifications
          </h2>
          <p className={css.text}>
            Get notified in your browser when something important happens — like tickets, mentions, due dates and meeting reminders.
          </p>
        </div>
        <div className={css.footer}>
          <button type="button" className={css.later} onClick={notNow} disabled={pending}>
            Not now
          </button>
          <button type="button" className={css.enable} onClick={() => void enable()} disabled={pending}>
            Enable notifications
          </button>
        </div>
      </div>
    </dialog>
  );
}
