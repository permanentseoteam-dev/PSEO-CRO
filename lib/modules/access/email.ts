import "server-only";

/**
 * Sends the invite email through Resend when RESEND_API_KEY and EMAIL_FROM are set.
 * Returns false when email isn't set up, so the admin copies the link instead.
 */
export async function sendInviteEmail(to: string, link: string, inviter: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `${inviter} invited you to Permanent SEO`,
      text: `${inviter} invited you to the Permanent SEO portal.\n\nSet up your account: ${link}\n\nThe link works for 14 days.`,
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
