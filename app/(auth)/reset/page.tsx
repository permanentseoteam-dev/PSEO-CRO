import { ResetForm } from "./_components/reset-form";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { email, error } = await searchParams;
  return (
    <ResetForm
      initialEmail={email ?? ""}
      initialError={error === "link" ? "That reset link has expired. Ask for a new one." : undefined}
    />
  );
}
