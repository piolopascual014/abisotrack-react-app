import { describe, expect, it } from "vitest";
import { initials, percent } from "../src/prototype/helpers";
import { emptyState } from "../src/prototype/state/AppStateProvider";

describe("empty application state", () => {
  it("contains no seeded records", () => {
    expect(emptyState.contacts).toEqual([]);
    expect(emptyState.treeNodes).toEqual([]);
    expect(emptyState.alerts).toEqual([]);
    expect(emptyState.smsLogs).toEqual([]);
    expect(emptyState.users).toEqual([]);
    expect(emptyState.audit).toEqual([]);
  });
});

describe("presentation helpers", () => {
  it("formats initials", () => expect(initials("Ada Lovelace")).toBe("AL"));
  it("calculates safe percentages", () => {
    expect(percent(3, 4)).toBe(75);
    expect(percent(0, 0)).toBe(0);
  });
});
