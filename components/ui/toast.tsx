"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ToastContext = createContext<(message: string) => void>(() => {});

/** Wraps the app once (root layout). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((m: string) => {
    setMessage(m);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={cn("toast", show && "show")} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

/** const toast = useToast(); toast("Saved"); */
export function useToast() {
  return useContext(ToastContext);
}
