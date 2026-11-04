import { ButtonLink } from "@/components/ui";
import { inviteState } from "@/lib/modules/access/logic";
import { getInviteByToken } from "@/lib/modules/access/queries";
import { AcceptForm } from "./_components/accept-form";

export const metadata = { title: "Accept invite" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getInviteByToken(token);
  const state = inv ? inviteState(inv) : null;

  if (!inv || state === "revoked" || state === "expired") {
    return (
      <Message
        title={state === "expired" ? "This invite has expired" : "This invite link doesn't work"}
        body="Ask the person who invited you to send a new one."
      />
    );
  }
  if (state === "accepted") {
    return <Message title="You've already accepted this invite" body={`Sign in with ${inv.email}.`} action />;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>Join Permanent SEO</h1>
        <p className="muted">
          {inv.inviter ? `${inv.inviter} invited you` : "You're invited"} as {inv.roleName}.
        </p>
      </div>
      <AcceptForm token={token} email={inv.email} defaultName={inv.name ?? ""} />
    </div>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: boolean }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1>{title}</h1>
        <p className="muted">{body}</p>
      </div>
      {action ? (
        <ButtonLink href="/login" variant="primary" className="w-full">
          Sign in
        </ButtonLink>
      ) : null}
    </div>
  );
}
