"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, StatusDot, useToast } from "@/components/ui";
import { deletePushSubscription, savePushSubscription } from "../actions";
import { urlBase64ToBytes } from "../logic";

/** Service worker served at this path (see WIRING.md: copy features/chat-p2/sw/push-sw.js to public/). */
export const PUSH_SW_URL = "/push-sw.js";
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State = "loading" | "unsupported" | "not_configured" | "denied" | "off" | "on";

async function detect(): Promise<State> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!VAPID) return "not_configured";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_URL);
    return (await reg?.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Turn browser notifications on or off for this device. Quiet hours (Settings, user_settings.quiet_from/to)
 * are applied by the notify-push Edge Function, not here.
 */
export function PushToggle() {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    void detect().then(setState);
  }, []);

  function turnOn() {
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.register(PUSH_SW_URL);
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(VAPID) });
        const json = sub.toJSON();
        const r = await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          userAgent: navigator.userAgent.slice(0, 300),
        });
        if (!r.ok) {
          await sub.unsubscribe();
          return toast(r.error);
        }
        setState("on");
        toast("Notifications on for this device");
      } catch {
        setState(Notification.permission === "denied" ? "denied" : "off");
        toast("Couldn't turn on notifications");
      }
    });
  }

  function turnOff() {
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_URL);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      toast("Notifications off for this device");
    });
  }

  const label: Record<State, ReactNode> = {
    loading: <StatusDot tone="muted">Checking this device</StatusDot>,
    unsupported: <StatusDot tone="muted">{"This browser can't show notifications"}</StatusDot>,
    not_configured: <StatusDot tone="muted">{"Browser notifications aren't set up yet"}</StatusDot>,
    denied: <StatusDot tone="warn">Blocked in browser settings</StatusDot>,
    off: <StatusDot tone="muted">Off on this device</StatusDot>,
    on: <StatusDot tone="ok">On for this device</StatusDot>,
  };

  return (
    <div className="row between">
      {label[state]}
      {state === "off" ? (
        <Button size="sm" variant="primary" disabled={pending} onClick={turnOn}>Turn on</Button>
      ) : state === "on" ? (
        <Button size="sm" disabled={pending} onClick={turnOff}>Turn off</Button>
      ) : null}
    </div>
  );
}
