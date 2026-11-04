"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, X } from "lucide-react";
import { IconButton, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { sendVoiceNote } from "../actions";
import { MAX_VOICE_SECONDS, downsamplePeaks, formatDuration, pickVoiceMime, voicePath } from "../logic";

type State = { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "sending" };

/**
 * Mic button for the chat composer. Records up to 5 minutes with MediaRecorder, uploads to the
 * chat-files bucket at <channel_id>/<uuid>-voice-note.<ext>, then posts a message carrying the file.
 */
export function VoiceRecorder({ channelId, disabled }: { channelId: string; disabled?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "idle" });
  const rec = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    audio: AudioContext;
    chunks: Blob[];
    levels: number[];
    started: number;
    timer: number;
    cancelled: boolean;
  } | null>(null);

  useEffect(() => () => stopAll(true), []);

  function stopAll(cancel: boolean) {
    const r = rec.current;
    if (!r) return;
    r.cancelled = cancel;
    window.clearInterval(r.timer);
    if (r.recorder.state !== "inactive") r.recorder.stop();
    r.stream.getTracks().forEach((t) => t.stop());
    void r.audio.close();
  }

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      toast("This browser can't record audio");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast("Allow microphone access to record a voice note");
      return;
    }
    const mime = pickVoiceMime((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 256;
    audio.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const r = { recorder, stream, audio, chunks: [] as Blob[], levels: [] as number[], started: Date.now(), timer: 0, cancelled: false };
    rec.current = r;
    recorder.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
    recorder.onstop = () => {
      if (!r.cancelled) void upload(r.chunks, recorder.mimeType || mime || "audio/webm", (Date.now() - r.started) / 1000, r.levels);
      rec.current = null;
    };
    r.timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
      r.levels.push(peak);
      const seconds = (Date.now() - r.started) / 1000;
      if (seconds >= MAX_VOICE_SECONDS) stopAll(false);
      else setState({ kind: "recording", seconds });
    }, 100);
    recorder.start(1000);
    setState({ kind: "recording", seconds: 0 });
  }

  async function upload(chunks: Blob[], mime: string, duration: number, levels: number[]) {
    if (duration < 0.5) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "sending" });
    const blob = new Blob(chunks, { type: mime });
    const key = crypto.randomUUID();
    const path = voicePath(channelId, key, mime);
    const supabase = createClient();
    const { error } = await supabase.storage.from("chat-files").upload(path, blob, { contentType: mime });
    if (error) {
      toast("Couldn't upload the voice note. Try again.");
      setState({ kind: "idle" });
      return;
    }
    const res = await sendVoiceNote({
      channelId,
      clientKey: key,
      path,
      name: path.split("/")[1],
      mime: mime.split(";")[0],
      size: blob.size,
      duration: Math.min(duration, MAX_VOICE_SECONDS),
      peaks: downsamplePeaks(levels),
    });
    if (!res.ok) {
      await supabase.storage.from("chat-files").remove([path]);
      toast(res.error);
    }
    setState({ kind: "idle" });
  }

  if (state.kind === "recording") {
    const left = MAX_VOICE_SECONDS - state.seconds;
    return (
      <div className="row" style={{ gap: 6 }} aria-live="polite">
        <span className="status t-danger">
          <i aria-hidden="true" />
          <span className="num">{formatDuration(state.seconds)}</span>
        </span>
        {left <= 30 ? <span className="small muted num">{formatDuration(left)} left</span> : null}
        <IconButton label="Cancel voice note" onClick={() => { stopAll(true); setState({ kind: "idle" }); }}>
          <X size={16} />
        </IconButton>
        <IconButton label="Stop and send" onClick={() => stopAll(false)}>
          <Send size={16} />
        </IconButton>
      </div>
    );
  }

  return (
    <IconButton label={state.kind === "sending" ? "Sending voice note" : "Record a voice note"} disabled={disabled || state.kind === "sending"} onClick={start}>
      {state.kind === "sending" ? <Square size={16} /> : <Mic size={16} />}
    </IconButton>
  );
}
