export type Presence = "available" | "meeting" | "focus" | "away" | "sick" | "offline";

/** One staff member as the directory and org chart see them. */
export type Person = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  departmentId: string | null;
  department: string | null;
  managerId: string | null;
  presence: Presence;
  statusNote: string | null;
  skills: string[];
  phone: string | null;
  joinedOn: string | null; // yyyy-mm-dd
  shift: string | null;
  clockedIn: boolean;
};

export type Department = { id: string; name: string; headId: string | null };

export type ReviewStatus = "self_review" | "manager_review" | "shared" | "acknowledged";
export type Confidence = "on_track" | "at_risk" | "off_track";
export type Direction = "higher" | "lower";

export type KpiRow = {
  id: string; // kpi_values.id
  kpiId: string;
  name: string;
  unit: string;
  direction: Direction;
  weight: number;
  value: number;
  target: number;
};

export type Cycle = { id: string; quarter: string; selfDue: string; managerDue: string; status: "open" | "closed" };

export type Review = { memberId: string; status: ReviewStatus };

export type KeyResult = { id: string; okrId: string; position: number; title: string; progress: number; confidence: Confidence };
export type Objective = { id: string; title: string; ownerId: string; owner: string; quarter: string; keyResults: KeyResult[] };

export type KpiDef = {
  id: string;
  name: string;
  unit: string;
  direction: Direction;
  weight: number;
  source: "portal" | "manual";
  department: string | null;
};
