import { describe, expect, it } from "vitest";
import {
  canArchive,
  canSetAdminsOnly,
  downsamplePeaks,
  duplicateTargets,
  formatDuration,
  importProgress,
  importSince,
  inQuietHours,
  meetingMessage,
  meetingWhen,
  minutesInZone,
  parseTime,
  pickVoiceMime,
  readSignal,
  shouldOffer,
  shouldPush,
  urlBase64ToBytes,
  voicePath,
} from "../logic";

describe("voice notes", () => {
  it("picks the first supported recorder format", () => {
    expect(pickVoiceMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickVoiceMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickVoiceMime(() => false)).toBe("");
  });
  it("builds a chat-files path under the channel", () => {
    expect(voicePath("ch1", "abc", "audio/webm;codecs=opus")).toBe("ch1/abc-voice-note.webm");
    expect(voicePath("ch1", "abc", "audio/mp4")).toBe("ch1/abc-voice-note.m4a");
  });
  it("formats durations", () => {
    expect(formatDuration(7.9)).toBe("0:07");
    expect(formatDuration(299)).toBe("4:59");
    expect(formatDuration(300)).toBe("5:00");
    expect(formatDuration(-3)).toBe("0:00");
  });
  it("downsamples peaks to 0..1", () => {
    const p = downsamplePeaks([0, 0.2, -0.5, 0.1, 0.25, 0.05], 3);
    expect(p).toEqual([0.4, 1, 0.5]);
    expect(downsamplePeaks([], 4)).toEqual([0, 0, 0, 0]);
    expect(downsamplePeaks([0.3], 4)).toHaveLength(4);
  });
});

describe("huddles", () => {
  it("lets exactly one side of a pair offer", () => {
    expect(shouldOffer("a", "b")).toBe(true);
    expect(shouldOffer("b", "a")).toBe(false);
  });
  it("reads only valid signals addressed to me", () => {
    expect(readSignal({ type: "offer", from: "b", to: "a", sdp: "x" }, "a")).not.toBeNull();
    expect(readSignal({ type: "offer", from: "b", to: "c", sdp: "x" }, "a")).toBeNull();
    expect(readSignal({ type: "answer", from: "a", to: "a", sdp: "x" }, "a")).toBeNull();
    expect(readSignal({ type: "ice", from: "b", to: "a", candidate: { candidate: "c", sdpMid: "0", sdpMLineIndex: 0 } }, "a")).not.toBeNull();
    expect(readSignal({ type: "ice", from: "b", to: "a" }, "a")).toBeNull();
    expect(readSignal("nope", "a")).toBeNull();
  });
});

describe("channel settings", () => {
  it("archives channels and groups, not DMs", () => {
    expect(canArchive("public")).toBe(true);
    expect(canArchive("group")).toBe(true);
    expect(canArchive("dm")).toBe(false);
    expect(canSetAdminsOnly("client")).toBe(true);
    expect(canSetAdminsOnly("group")).toBe(false);
  });
});

describe("schedule meeting", () => {
  it("writes the channel message", () => {
    const when = meetingWhen("2026-11-05", "15:00");
    expect(when).toBe("Thu 5 Nov at 15:00");
    expect(meetingMessage("Sara Malik", "Q4 plan", when, 30, 1)).toBe('Sara Malik scheduled "Q4 plan" for Thu 5 Nov at 15:00 (30 min) with 1 person.');
    expect(meetingMessage("Sara Malik", "Q4 plan", when, 30, 3)).toContain("3 people");
  });
});

describe("quiet hours and push", () => {
  it("parses times", () => {
    expect(parseTime("22:00")).toBe(1320);
    expect(parseTime("07:30:00")).toBe(450);
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
  it("handles same-day and overnight windows", () => {
    expect(inQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(6 * 60, "22:00", "07:00")).toBe(true);
    expect(inQuietHours(7 * 60, "22:00", "07:00")).toBe(false);
    expect(inQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
    expect(inQuietHours(14 * 60, "12:00", "14:00")).toBe(false);
    expect(inQuietHours(13 * 60, null, "14:00")).toBe(false);
    expect(inQuietHours(13 * 60, "09:00", "09:00")).toBe(false);
  });
  it("reads the time in a zone", () => {
    expect(minutesInZone(new Date("2026-11-04T20:30:00Z"), "Asia/Dubai")).toBe(30);
    expect(minutesInZone(new Date("2026-11-04T08:15:00Z"), "UTC")).toBe(495);
  });
  it("respects notify settings", () => {
    expect(shouldPush({ notify: "all", isMention: false, quiet: false })).toBe(true);
    expect(shouldPush({ notify: "mentions", isMention: false, quiet: false })).toBe(false);
    expect(shouldPush({ notify: "mentions", isMention: true, quiet: false })).toBe(true);
    expect(shouldPush({ notify: "mute", isMention: true, quiet: false })).toBe(false);
    expect(shouldPush({ notify: "all", isMention: true, quiet: true })).toBe(false);
  });
  it("decodes a base64url key", () => {
    expect([...urlBase64ToBytes("AQID_w")]).toEqual([1, 2, 3, 255]);
  });
});

describe("Slack", () => {
  it("computes the import window", () => {
    expect(importSince(new Date("2026-11-04T00:00:00Z"), 90)).toBe("2026-08-06T00:00:00.000Z");
  });
  it("finds portal channels mapped twice", () => {
    expect(duplicateTargets([{ channelId: "a" }, { channelId: "b" }, { channelId: "a" }, { channelId: null }, { channelId: null }])).toEqual(["a"]);
  });
  it("reports progress", () => {
    expect(importProgress(642, 1284)).toBe(50);
    expect(importProgress(10, null)).toBeNull();
    expect(importProgress(2000, 1284)).toBe(100);
  });
});
