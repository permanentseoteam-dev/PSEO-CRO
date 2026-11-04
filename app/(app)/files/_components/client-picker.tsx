"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import type { Option } from "@/lib/modules/clientops/types";

export function ClientPicker({ clients, value }: { clients: Option[]; value: string }) {
  const router = useRouter();
  return (
    <Select aria-label="Client" value={value} onChange={(e) => router.push(`/files?client=${e.target.value}`)}>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
