"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import s from "./ticket.module.css";

/** Pop-up shell for a task opened from inside the app (intercepted /t/KEY). Esc, backdrop and X go back. */
export function TaskModal({ children }: { children: ReactNode }) {
  // A slot keeps its last page on soft navigation, so hide once the URL leaves /t/… (e.g. after Delete).
  const open = usePathname().startsWith("/t/");
  if (!open) return null;
  return <TaskDialog>{children}</TaskDialog>;
}

function TaskDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { key } = useParams<{ key: string }>();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${s.modal}`}
      // Nested dialogs (Delete, Copy to…) fire their own close events; only react to this one.
      onClose={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div className="modal-head">
        <h2>{decodeURIComponent(key ?? "").toUpperCase()}</h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => router.back()}>
          <X />
        </button>
      </div>
      <div className={`modal-body ${s.modalBody}`}>{children}</div>
    </dialog>
  );
}
