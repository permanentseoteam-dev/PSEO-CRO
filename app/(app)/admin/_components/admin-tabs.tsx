import { Tabs } from "@/components/ui";

const ITEMS = [
  { value: "people", label: "People", href: "/admin/people" },
  { value: "invites", label: "Invites", href: "/admin/invites" },
  { value: "roles", label: "Roles & permissions", href: "/admin/roles" },
  { value: "audit", label: "Audit log", href: "/admin/audit" },
];

/** Page heading plus the admin sub-tabs (URL-driven). */
export function AdminHeader({ value }: { value: (typeof ITEMS)[number]["value"] }) {
  return (
    <>
      <h1>Admin</h1>
      <Tabs label="Admin sections" value={value} items={ITEMS} />
    </>
  );
}
