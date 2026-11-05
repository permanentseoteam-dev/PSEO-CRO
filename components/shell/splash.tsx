"use client";

import { useEffect, useState } from "react";
import styles from "./splash.module.css";

const MIN_VISIBLE_MS = 700;
const FADE_MS = 250;
const SAFETY_MS = 6000;

// Rendered by the root layout, so it is in the server HTML and shows on first paint.
// The root layout doesn't re-render on client-side navigation, so this only runs on a full load.
export function Splash() {
  const [phase, setPhase] = useState<"shown" | "hiding" | "gone">("shown");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let done = false;

    const hide = () => {
      if (done) return;
      done = true;
      if (reduced) {
        setPhase("gone");
        return;
      }
      setPhase("hiding");
      timers.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
    };

    const onLoad = () => {
      // performance.now() counts from navigation start, i.e. roughly since the splash first painted.
      const wait = reduced ? 0 : Math.max(0, MIN_VISIBLE_MS - performance.now());
      timers.push(window.setTimeout(hide, wait));
    };

    timers.push(window.setTimeout(hide, SAFETY_MS));
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`${styles.overlay} ${phase === "hiding" ? styles.hiding : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- must paint before JS; plain img avoids the image loader */}
      <img src="/brand-logo.jpg" alt="" width={96} height={96} className={styles.logo} />
      <div className={styles.track}>
        <div className={styles.bar} />
      </div>
    </div>
  );
}
