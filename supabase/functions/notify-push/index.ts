// notify-push Edge Function (stub). Lives at supabase/functions/notify-push/index.ts (see features/chat-p2/WIRING.md).
// Called by a Database Webhook on INSERT into public.notifications. It loads the recipient's quiet hours
// (user_settings, 0101_shell) and devices (push_subscriptions, 0205), skips quiet hours, and hands the
// payload to a PushSender. No VAPID keys exist yet, so the sender is the not-configured one and nothing is sent.
// Self-contained on purpose (Deno bundles only this folder); the quiet-hours maths mirrors features/chat-p2/logic.ts.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

type NotificationRow = {
  id: string;
  member_id: string;
  kind: string;
  action: string;
  subject: string | null;
  detail: string | null;
  href: string | null;
};
type Subscription = { endpoint: string; p256dh: string; auth: string };
type Payload = { title: string; body: string; url: string; tag: string };

export interface PushSender {
  readonly configured: boolean;
  send(sub: Subscription, payload: Payload): Promise<{ ok: boolean; gone?: boolean }>;
}

/** Until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set, nothing is sent. */
const notConfiguredSender: PushSender = { configured: false, send: async () => ({ ok: false }) };

/** Agency time zone for quiet hours (members have no time zone column yet). */
const TIME_ZONE = Deno.env.get("PORTAL_TIME_ZONE") ?? "Asia/Dubai";

function parseTime(t: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function inQuietHours(now: Date, from: string | null, to: string | null): boolean {
  const f = parseTime(from);
  const t = parseTime(to);
  if (f == null || t == null || f === t) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const n = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  return f < t ? n >= f && n < t : n >= f || n < t;
}

async function rest<T>(path: string): Promise<T> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key ?? "", Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  // The webhook sends a shared secret header; reject anything else.
  const secret = Deno.env.get("NOTIFY_PUSH_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "unauthorised" }, 401);

  const body = (await req.json().catch(() => null)) as { type?: string; record?: NotificationRow } | null;
  const n = body?.record;
  if (body?.type !== "INSERT" || !n?.member_id) return json({ skipped: "not an insert" });

  const [settings] = await rest<{ quiet_from: string | null; quiet_to: string | null }[]>(
    `user_settings?member_id=eq.${n.member_id}&select=quiet_from,quiet_to`,
  );
  if (inQuietHours(new Date(), settings?.quiet_from ?? null, settings?.quiet_to ?? null)) return json({ skipped: "quiet hours" });

  const subs = await rest<Subscription[]>(`push_subscriptions?member_id=eq.${n.member_id}&select=endpoint,p256dh,auth`);
  if (!subs.length) return json({ skipped: "no devices" });

  const sender = notConfiguredSender;
  if (!sender.configured) return json({ skipped: "push not configured", devices: subs.length });

  const payload: Payload = {
    title: n.subject ? `${n.action} ${n.subject}` : n.action,
    body: n.detail ?? "",
    url: n.href ?? "/home",
    tag: n.kind,
  };
  const results = await Promise.all(subs.map((s) => sender.send(s, payload)));
  // A real sender reports gone (404/410) endpoints; delete those rows here.
  return json({ sent: results.filter((r) => r.ok).length, gone: results.filter((r) => r.gone).length });
});
