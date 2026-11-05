import { describe, expect, it } from "vitest";
import { mfaGate, needsVerify, requiredByPolicy, verifyPath } from "../mfa-logic";

const noFactor = { currentLevel: "aal1", nextLevel: "aal1" };
const pending = { currentLevel: "aal1", nextLevel: "aal2" };
const done = { currentLevel: "aal2", nextLevel: "aal2" };

describe("needsVerify", () => {
  it("is true only with a verified factor and a session below aal2", () => {
    expect(needsVerify(pending)).toBe(true);
    expect(needsVerify({ currentLevel: null, nextLevel: "aal2" })).toBe(true);
    expect(needsVerify(done)).toBe(false);
    expect(needsVerify(noFactor)).toBe(false);
    expect(needsVerify(null)).toBe(false);
  });
});

describe("mfaGate", () => {
  it("asks for the code before anything else", () => {
    expect(mfaGate(pending, false)).toBe("verify");
    expect(mfaGate(pending, true)).toBe("verify");
  });
  it("sends required people without a factor to set one up", () => {
    expect(mfaGate(noFactor, true)).toBe("enroll");
    expect(mfaGate(null, true)).toBe("enroll");
  });
  it("lets everyone else through", () => {
    expect(mfaGate(noFactor, false)).toBe("ok");
    expect(mfaGate(done, true)).toBe("ok");
    expect(mfaGate(done, false)).toBe("ok");
  });
});

describe("requiredByPolicy", () => {
  it("covers staff with a listed role", () => {
    expect(requiredByPolicy("staff", ["member", "finance"], ["finance"])).toBe(true);
    expect(requiredByPolicy("staff", ["member"], ["finance"])).toBe(false);
    expect(requiredByPolicy("staff", ["member"], [])).toBe(false);
  });
  it("never covers client logins", () => {
    expect(requiredByPolicy("client", ["finance"], ["finance"])).toBe(false);
  });
});

describe("verifyPath", () => {
  it("keeps a safe next and drops unsafe ones", () => {
    expect(verifyPath("/clients?x=1")).toBe("/login/verify?next=%2Fclients%3Fx%3D1");
    expect(verifyPath("//evil.com")).toBe("/login/verify");
    expect(verifyPath("https://evil.com")).toBe("/login/verify");
    expect(verifyPath(undefined)).toBe("/login/verify");
  });
});
