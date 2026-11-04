import type { Colour, Concern, Outcome, State, WaitKind } from "./logic";

export type Option = { id: string; name: string };

export type SlaSettings = {
  replyHours: number;
  requestHours: number;
  changesHours: number;
  timezone: string;
  dayStart: string;
  dayEnd: string;
  workdays: number[];
  ontimeGoal: number;
  alertAnswerer: boolean;
  alertManager: boolean;
  postDaily: boolean;
};

export type OpenWait = {
  id: string;
  clientName: string;
  fromName: string | null;
  kind: WaitKind;
  subject: string;
  waitedMin: number;
  targetMin: number;
  answererName: string | null;
  state: State;
};

export type AnsweredWait = {
  id: string;
  clientName: string;
  kind: WaitKind;
  askedAt: string;
  answeredByName: string | null;
  tookMin: number;
  targetMin: number;
};

export type MeetingAction = {
  id: string;
  title: string;
  ownerName: string | null;
  outcome: Outcome;
  ticketKey: string | null;
  done: boolean;
};

export type Meeting = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  heldAt: string;
  durationMin: number | null;
  people: string[];
  guests: string | null;
  attendeeEmails: string | null;
  summary: string | null;
  decisions: string[];
  concerns: Concern[];
  status: "to_review" | "reviewed" | "not_client";
  actions: MeetingAction[];
};

export type Folder = { id: string; name: string; kind: "brand" | "from_client" | "custom"; clientVisible: boolean; count: number };

export type FileVersion = { id: string; version: number; sizeBytes: number; uploadedBy: string | null; createdAt: string };

export type ClientFile = { id: string; name: string; shared: boolean; versions: FileVersion[] };

export type BrandKit = { colours: Colour[]; fonts: string | null; tone: string | null; dos: string[]; donts: string[] };

export type SearchHit = { id: string; name: string; clientId: string; clientName: string; folderId: string; folderName: string; version: number; date: string };
