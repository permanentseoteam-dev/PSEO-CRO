import { describe, expect, it } from "vitest";
import {
  band,
  buildOrg,
  kpiScore,
  kpiSummary,
  matchesPerson,
  okrAverage,
  quarterOf,
  quarterScore,
  recentQuarters,
  searchOrg,
  teamOf,
  unplacedReason,
} from "../logic";
import type { Department, Person } from "../types";

const person = (id: string, over: Partial<Person> = {}): Person => ({
  id,
  name: `Person ${id}`,
  email: `${id}@x.test`,
  title: "Tester",
  departmentId: null,
  department: null,
  managerId: null,
  presence: "available",
  statusNote: null,
  skills: [],
  phone: null,
  joinedOn: null,
  shift: null,
  clockedIn: false,
  ...over,
});

describe("matchesPerson", () => {
  const p = person("a", { name: "Omar Haddad", title: "SEO Lead", department: "SEO", skills: ["Link building"] });
  it("filters by department and searches name, title and skills", () => {
    expect(matchesPerson(p, "", "")).toBe(true);
    expect(matchesPerson(p, "PPC", "")).toBe(false);
    expect(matchesPerson(p, "SEO", "link")).toBe(true);
    expect(matchesPerson(p, "", "seo lead")).toBe(true);
    expect(matchesPerson(p, "", "figma")).toBe(false);
  });
});

describe("buildOrg", () => {
  const depts: Department[] = [{ id: "d1", name: "SEO", headId: "omar" }];
  it("builds a tree from manager_id with team sizes", () => {
    const people = [
      person("ceo"),
      person("omar", { managerId: "ceo", departmentId: "d1" }),
      person("ayesha", { managerId: "omar" }),
      person("daniel", { managerId: "omar" }),
    ];
    const { roots, unplaced } = buildOrg(people, depts);
    expect(roots.map((r) => r.person.id)).toEqual(["ceo"]);
    expect(roots[0].teamSize).toBe(3);
    expect(roots[0].children[0].teamSize).toBe(2);
    expect(unplaced).toEqual([]);
  });

  it("falls back to the department head, never to yourself", () => {
    const people = [person("ceo"), person("omar", { managerId: "ceo", departmentId: "d1" }), person("noor", { departmentId: "d1" })];
    const { roots } = buildOrg(people, depts);
    expect(roots[0].children[0].children.map((c) => c.person.id)).toEqual(["noor"]);
  });

  it("puts people with no position and no reports in unplaced", () => {
    const people = [person("ceo"), person("omar", { managerId: "ceo" }), person("lina")];
    expect(buildOrg(people, []).unplaced.map((p) => p.id)).toEqual(["lina"]);
  });

  it("survives a reporting loop", () => {
    const people = [person("ceo"), person("x", { managerId: "ceo" }), person("a", { managerId: "b" }), person("b", { managerId: "a" })];
    const { roots, unplaced } = buildOrg(people, []);
    expect(roots[0].teamSize).toBe(1);
    expect(unplaced.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
});

describe("searchOrg", () => {
  it("returns hits and the ancestors to open", () => {
    const people = [person("ceo", { name: "Yusuf" }), person("omar", { name: "Omar", managerId: "ceo" }), person("ayesha", { name: "Ayesha", managerId: "omar" })];
    const { roots } = buildOrg(people, []);
    const r = searchOrg(roots, "aye");
    expect([...r.hits]).toEqual(["ayesha"]);
    expect([...r.open].sort()).toEqual(["ceo", "omar"]);
    expect(searchOrg(roots, " ").hits.size).toBe(0);
  });
});

describe("unplacedReason", () => {
  const now = new Date("2026-11-04T08:00:00Z");
  it("shows the join date for recent joiners", () => {
    expect(unplacedReason({ joinedOn: "2026-11-02" }, now)).toBe("Joined 2 Nov");
    expect(unplacedReason({ joinedOn: "2025-02-10" }, now)).toBe("No manager set");
    expect(unplacedReason({ joinedOn: null }, now)).toBe("No manager set");
  });
});

describe("teamOf", () => {
  const depts: Department[] = [{ id: "cs", name: "Client Success", headId: "sara" }];
  const people = [
    person("sara", { departmentId: "cs" }),
    person("hamza", { departmentId: "cs", managerId: "sara" }),
    person("zara", { managerId: "sara" }),
    person("omar"),
  ];
  it("team scope: reports and my department, not me", () => {
    expect(teamOf({ id: "sara", departmentId: "cs" }, people, depts, "team").map((p) => p.id)).toEqual(["hamza", "zara"]);
  });
  it("all scope: everyone else", () => {
    expect(teamOf({ id: "sara", departmentId: "cs" }, people, depts, "all")).toHaveLength(3);
  });
});

describe("scores", () => {
  it("scores higher- and lower-is-better KPIs, capped at 100", () => {
    expect(kpiScore(2, 3, "higher")).toBe(67);
    expect(kpiScore(120, 100, "higher")).toBe(100);
    expect(kpiScore(5, 0, "higher")).toBe(100);
    expect(kpiScore(46, 40, "lower")).toBe(87);
    expect(kpiScore(30, 40, "lower")).toBe(100);
  });

  it("weights the quarter score", () => {
    expect(quarterScore([])).toBeNull();
    expect(
      quarterScore([
        { value: 100, target: 100, direction: "higher", weight: 75 },
        { value: 0, target: 100, direction: "higher", weight: 25 },
      ]),
    ).toBe(75);
    expect(quarterScore([{ value: 50, target: 100, direction: "higher", weight: 0 }])).toBe(50);
  });

  it("counts KPIs on target and within 5%", () => {
    expect(
      kpiSummary([
        { value: 3, target: 3, direction: "higher" },
        { value: 92, target: 95, direction: "higher" },
        { value: 50, target: 95, direction: "higher" },
      ]),
    ).toEqual({ onTarget: 1, near: 1, total: 3 });
  });

  it("bands: 80+ good, 60-79 warn, below 60 low", () => {
    expect(band(80)).toBe("ok");
    expect(band(79)).toBe("warn");
    expect(band(60)).toBe("warn");
    expect(band(59)).toBe("danger");
  });

  it("averages key result progress", () => {
    expect(okrAverage([{ progress: 67 }, { progress: 80 }, { progress: 100 }])).toBe(82);
    expect(okrAverage([])).toBe(0);
  });
});

describe("quarters", () => {
  it("uses the Dubai calendar", () => {
    expect(quarterOf(new Date("2026-11-04T08:00:00Z"))).toBe("Q4 2026");
    expect(quarterOf(new Date("2026-12-31T21:00:00Z"))).toBe("Q1 2027");
  });
  it("lists recent quarters across a year boundary", () => {
    expect(recentQuarters(new Date("2026-11-04T08:00:00Z"))).toEqual(["Q4 2026", "Q3 2026", "Q2 2026", "Q1 2026"]);
    expect(recentQuarters(new Date("2026-02-01T08:00:00Z"), 3)).toEqual(["Q1 2026", "Q4 2025", "Q3 2025"]);
  });
});
