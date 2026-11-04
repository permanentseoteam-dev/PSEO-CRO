"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Avatar, Button, Dialog, IconButton, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { joinHuddle, leaveHuddle, startHuddle } from "../actions";
import { MAX_HUDDLE_PEOPLE, STUN_SERVERS, huddleTopic, readSignal, shouldOffer, type Signal } from "../logic";
import type { Huddle as HuddleRow, HuddleMedia } from "../types";

type Props = {
  channelId: string;
  me: { id: string; name: string };
  /** Live huddle in this conversation, from getChannelExtras(). */
  huddle: HuddleRow | null;
  /** False in archived or admins-only conversations where I can't post. */
  canStart: boolean;
};

type Peer = { id: string; name: string; stream: MediaStream | null };

/**
 * Huddle button for the conversation header plus the call panel. WebRTC mesh (up to 6 people);
 * offers, answers and ICE travel over the private Realtime broadcast topic huddle:<channel_id>,
 * and Presence says who is in the call. STUN: stun.l.google.com (no TURN yet).
 */
export function Huddle({ channelId, me, huddle, canStart }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [choose, setChoose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState<{ huddleId: string; media: HuddleMedia } | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const local = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => () => teardown(), []);

  function teardown() {
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    pendingIce.current.clear();
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    if (channel.current) void createClient().removeChannel(channel.current);
    channel.current = null;
    setPeers([]);
  }

  const send = (s: Signal) => channel.current?.send({ type: "broadcast", event: "signal", payload: s });

  function peerConnection(peerId: string, name: string) {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", from: me.id, to: peerId, candidate: e.candidate.toJSON() as Extract<Signal, { type: "ice" }>["candidate"] });
    };
    pc.ontrack = (e) => setPeers((ps) => ps.map((p) => (p.id === peerId ? { ...p, stream: e.streams[0] ?? p.stream } : p)));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") toast(`Lost the connection to ${name}`);
    };
    pcs.current.set(peerId, pc);
    return pc;
  }

  async function flushIce(peerId: string, pc: RTCPeerConnection) {
    for (const c of pendingIce.current.get(peerId) ?? []) await pc.addIceCandidate(c).catch(() => undefined);
    pendingIce.current.delete(peerId);
  }

  async function onSignal(s: Signal, names: Map<string, string>) {
    const name = names.get(s.from) ?? "Someone";
    if (s.type === "offer") {
      const pc = peerConnection(s.from, name);
      await pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
      await flushIce(s.from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", from: me.id, to: s.from, sdp: answer.sdp ?? "" });
    } else if (s.type === "answer") {
      const pc = pcs.current.get(s.from);
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription({ type: "answer", sdp: s.sdp });
        await flushIce(s.from, pc);
      }
    } else {
      const pc = pcs.current.get(s.from);
      if (pc?.remoteDescription) await pc.addIceCandidate(s.candidate).catch(() => undefined);
      else pendingIce.current.set(s.from, [...(pendingIce.current.get(s.from) ?? []), s.candidate]);
    }
  }

  async function connect(huddleId: string, media: HuddleMedia) {
    try {
      local.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === "video" });
    } catch {
      toast(media === "video" ? "Allow camera and microphone to join" : "Allow microphone access to join");
      await leaveHuddle({ huddleId });
      return false;
    }
    setCall({ huddleId, media });
    setMuted(false);
    setCamOff(false);

    const supabase = createClient();
    await supabase.realtime.setAuth();
    const names = new Map<string, string>();
    const ch = supabase.channel(huddleTopic(channelId), {
      config: { private: true, broadcast: { self: false }, presence: { key: me.id } },
    });
    channel.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ name: string }>();
      const here = Object.keys(state).filter((k) => k !== me.id);
      here.forEach((k) => names.set(k, state[k][0]?.name ?? "Someone"));
      setPeers((ps) => here.map((k) => ps.find((p) => p.id === k) ?? { id: k, name: names.get(k)!, stream: null }));
      for (const [id, pc] of pcs.current) {
        if (!here.includes(id)) {
          pc.close();
          pcs.current.delete(id);
        }
      }
      for (const id of here) {
        if (pcs.current.has(id) || !shouldOffer(me.id, id)) continue;
        const pc = peerConnection(id, names.get(id)!);
        void pc
          .createOffer()
          .then((o) => pc.setLocalDescription(o).then(() => send({ type: "offer", from: me.id, to: id, sdp: o.sdp ?? "" })));
      }
    });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => {
      const s = readSignal(payload, me.id);
      if (s) void onSignal(s, names);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void ch.track({ name: me.name });
      if (status === "CHANNEL_ERROR") toast("Couldn't reach the huddle. Check your connection.");
    });
    return true;
  }

  async function begin(media: HuddleMedia) {
    setChoose(false);
    setBusy(true);
    const res = huddle ? await joinHuddle({ huddleId: huddle.id }) : await startHuddle({ channelId, media });
    const huddleId = huddle ? huddle.id : res.ok && "data" in res ? res.data?.huddleId : undefined;
    if (!res.ok || !huddleId) {
      toast(res.ok ? "Couldn't start the huddle." : res.error);
      setBusy(false);
      return;
    }
    await connect(huddleId, huddle ? huddle.media : media);
    setBusy(false);
    router.refresh();
  }

  async function leave() {
    if (!call) return;
    const id = call.huddleId;
    teardown();
    setCall(null);
    await leaveHuddle({ huddleId: id });
    router.refresh();
  }

  function toggleMic() {
    local.current?.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  }
  function toggleCam() {
    local.current?.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff(!camOff);
  }

  const full = huddle ? huddle.participants.length >= MAX_HUDDLE_PEOPLE : false;

  return (
    <>
      {call ? null : huddle ? (
        <Button size="sm" variant="ghost" disabled={busy || full} onClick={() => begin(huddle.media)} title={full ? "This huddle is full" : undefined}>
          <span className="status t-ok">
            <i aria-hidden="true" />
            Join huddle <span className="num">{huddle.participants.length}</span>
          </span>
        </Button>
      ) : canStart ? (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setChoose(true)}>
          <Phone size={14} /> Huddle
        </Button>
      ) : null}

      <Dialog open={choose} onClose={() => setChoose(false)} title="Start a huddle">
        <p className="small muted" style={{ margin: 0 }}>Everyone in this conversation can join.</p>
        <div className="row">
          <Button variant="primary" onClick={() => begin("audio")}>
            <Phone size={14} /> Audio
          </Button>
          <Button onClick={() => begin("video")}>
            <Video size={14} /> Video
          </Button>
        </div>
      </Dialog>

      {call ? (
        <section
          aria-label="Huddle"
          className="bg-surface border border-line"
          style={{ position: "fixed", right: 12, bottom: 12, zIndex: 50, width: "min(380px, calc(100vw - 24px))", borderRadius: "var(--radius)", padding: 12, display: "grid", gap: 10, boxShadow: "var(--shadow, none)" }}
        >
          <div className="row between">
            <b>Huddle</b>
            <span className="small muted"><span className="num">{peers.length + 1}</span> in call</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
            <Tile name={`${me.name} (you)`} stream={call.media === "video" && !camOff ? local.current : null} muted video={call.media === "video"} videoRef={localVideo} />
            {peers.map((p) => (
              <Tile key={p.id} name={p.name} stream={p.stream} video={call.media === "video"} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: "center" }}>
            <IconButton label={muted ? "Unmute" : "Mute"} onClick={toggleMic}>
              {muted ? <MicOff size={16} /> : <Mic size={16} />}
            </IconButton>
            {call.media === "video" ? (
              <IconButton label={camOff ? "Turn camera on" : "Turn camera off"} onClick={toggleCam}>
                {camOff ? <VideoOff size={16} /> : <Video size={16} />}
              </IconButton>
            ) : null}
            <Button variant="primary-danger" size="sm" onClick={leave}>
              <PhoneOff size={14} /> Leave
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Tile({
  name,
  stream,
  video,
  muted,
  videoRef,
}: {
  name: string;
  stream: MediaStream | null;
  video: boolean;
  muted?: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const attach = (el: HTMLMediaElement | null) => {
    if (videoRef && el instanceof HTMLVideoElement) videoRef.current = el;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  };
  const showVideo = video && stream && stream.getVideoTracks().length > 0;
  return (
    <div className="bg-surface-2 border border-line" style={{ borderRadius: 8, aspectRatio: "4 / 3", display: "grid", placeItems: "center", overflow: "hidden", position: "relative" }}>
      {showVideo ? (
        <video ref={attach} autoPlay playsInline muted={muted} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <>
          <Avatar name={name} />
          {stream && !muted ? <audio ref={attach} autoPlay /> : null}
        </>
      )}
      <span className="small" style={{ position: "absolute", left: 6, bottom: 4, right: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
    </div>
  );
}
