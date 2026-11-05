import { redirect } from "next/navigation";

export default async function ProjectSpacePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  redirect(`/projects/${key}/tasks`);
}
