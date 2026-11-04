import type { Repeat, Rsvp } from "./logic";

export type Visibility = "team" | "private" | "client";

export type Attendee = { id: string; name: string; rsvp: Rsvp };

/** A meeting in office time (see logic.ts). */
export type CalEvent = {
  id: string;
  title: string;
  kind: "internal" | "client_meeting";
  clientId: string | null;
  clientName: string | null;
  date: string;
  start: number;
  mins: number;
  meetLink: string | null;
  location: string | null;
  agenda: string | null;
  guests: string[];
  repeat: Repeat;
  seriesId: string | null;
  visibility: Visibility;
  sendInvites: boolean;
  createdBy: string;
  attendees: Attendee[];
};

/** A colleague's busy time, without any meeting details. */
export type BusyBlock = { memberId: string; date: string; start: number; mins: number };

export type Person = { id: string; name: string };
export type ClientOption = { id: string; name: string };
