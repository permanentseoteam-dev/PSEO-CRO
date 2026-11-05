"use client";

import { createContext, useContext, useEffect } from "react";

/** Lets a detail page replace the generic top-bar title ("Client") with its own (the client's name). */
export const PageTitleContext = createContext<(title: string | null) => void>(() => {});

export function PageTitle({ title }: { title: string }) {
  const set = useContext(PageTitleContext);
  useEffect(() => {
    set(title);
    return () => set(null);
  }, [set, title]);
  return null;
}
