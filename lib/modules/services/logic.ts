import { z } from "zod";

export type Service = { id: string; name: string };
export type ServiceUsage = { templates: number; clients: number };

export const ServiceName = z
  .string()
  .trim()
  .min(2, "Service names need at least 2 characters.")
  .max(40, "Service names can be at most 40 characters.");

/** True when another service (not `exceptId`) already has this name, ignoring case and outer spaces. */
export function isDuplicateName(name: string, existing: { id: string; name: string }[], exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return existing.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === n);
}

export const duplicateError = (name: string) => `A service called "${name.trim()}" already exists.`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Confirm text for deleting a service. Rows that use it keep the name; nothing else is deleted. */
export function deleteWarning(name: string, u: ServiceUsage): string {
  const used = [u.templates ? plural(u.templates, "template", "templates") : "", u.clients ? plural(u.clients, "client", "clients") : ""]
    .filter(Boolean)
    .join(" and ");
  const middle = used ? `${used} ${u.templates + u.clients === 1 ? "uses" : "use"} it and will keep "${name}" as their service.` : "No templates or clients use it.";
  return `Delete "${name}"? ${middle} This can't be undone.`;
}

/** The service list plus any current values it no longer has, so editing a row never drops them. */
export function withCurrent(names: string[], current: string[]): string[] {
  return [...names, ...current.filter((c, i) => c && !names.includes(c) && current.indexOf(c) === i)];
}
