import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { todayIn } from "@/lib/modules/tickets/logic";
import { projectStats } from "@/lib/modules/work/logic";
import { listClients, listDepartments, listProjects, listStaff, projectTicketFacts } from "@/lib/modules/work/queries";
import type { ProjectCard } from "@/lib/modules/work/types";
import { ProjectsView } from "./_components/projects-view";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;

  const [projects, staff, departments, clients, facts] = await Promise.all([
    listProjects(),
    listStaff(),
    listDepartments(),
    listClients(),
    projectTicketFacts(),
  ]);
  const stats = projectStats(facts, todayIn());
  const person = new Map(staff.map((m) => [m.id, m]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const manageAll = can(me, "work.projects.manage", "all");
  const manageTeam = can(me, "work.projects.manage", "team");
  // Mirrors in_my_team(): me, my reports, or my department. RLS has the final say.
  const inMyTeam = (id: string | null) => {
    const m = id ? person.get(id) : undefined;
    return !!m && (m.id === me.id || m.managerId === me.id || (!!me.departmentId && m.departmentId === me.departmentId));
  };

  const cards: ProjectCard[] = projects.map((p) => ({
    ...p,
    department: (p.departmentId && deptName.get(p.departmentId)) || "No department",
    client: (p.clientId && clientName.get(p.clientId)) || "",
    lead: (p.leadId && person.get(p.leadId)?.name) || "No lead",
    ...(stats[p.id] ?? { open: 0, overdue: 0, done30: 0 }),
    canEdit: manageAll || (manageTeam && inMyTeam(p.leadId)),
  }));

  return (
    <ProjectsView
      cards={cards}
      canCreate={manageTeam}
      people={staff.map(({ id, name }) => ({ id, name }))}
      departments={departments}
      clients={clients}
    />
  );
}
