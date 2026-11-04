"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { IconButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { VOICE_BARS, formatDuration } from "../logic";
import type { ChatFile } from "../types";

/** Inline player for an audio item in messages.files: play/pause, waveform with progress, length. */
export function VoiceNote({ file }: { file: ChatFile }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const duration = file.duration ?? 0;
  const peaks = file.peaks?.length ? file.peaks : Array(VOICE_BARS).fill(0.3);

  useEffect(() => () => audio.current?.pause(), []);

  async function toggle() {
    if (!audio.current) {
      const { data } = await createClient().storage.from("chat-files").createSignedUrl(file.path, 3600);
      if (!data?.signedUrl) {
        setFailed(true);
        return;
      }
      const a = new Audio(data.signedUrl);
      a.ontimeupdate = () => setAt(a.currentTime);
      a.onended = () => {
        setPlaying(false);
        setAt(0);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (a.paused) {
      await a.play().catch(() => setFailed(true));
      setPlaying(!a.paused);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  const done = duration > 0 ? at / duration : 0;
  return (
    <div className="row" style={{ gap: 8, flexWrap: "nowrap", maxWidth: 320 }}>
      <IconButton label={playing ? "Pause voice note" : "Play voice note"} size="sm" onClick={toggle} disabled={failed}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </IconButton>
      <span className="flex items-center gap-[2px] h-7 min-w-0 flex-1" aria-hidden="true">
        {peaks.map((p, i) => (
          <i
            key={i}
            className={i / peaks.length < done ? "bg-accent" : "bg-line-2"}
            style={{ display: "block", width: 3, borderRadius: 2, height: `${Math.max(3, Math.round(p * 24))}px`, flex: "none" }}
          />
        ))}
      </span>
      <span className="small muted num">{failed ? "Can't play" : formatDuration(playing || at ? at : duration)}</span>
    </div>
  );
}
