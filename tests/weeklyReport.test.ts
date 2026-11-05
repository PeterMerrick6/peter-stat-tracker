import { describe, expect, it } from "vitest";
import { buildWeeklyReport, previousReportWeek } from "../src/lib/weeklyReport";
import { createDefaultGoals } from "../src/lib/goals";
import type { GoalEntry } from "../src/types";

const goals = createDefaultGoals();
const now = new Date("2026-11-09T15:00:00Z");
const entries: GoalEntry[] = [
  { goalId: "goal-miles", periodDate: "2026-11-02", value: 0, status: "minimum" },
  { goalId: "goal-flashcards", periodDate: "2026-11-03", value: null, status: "normal" },
  { goalId: "goal-weight", periodDate: "2026-11-02", value: 180.5, status: "logged" },
  { goalId: "goal-weight", periodDate: "2026-10-26", value: 181, status: "logged" },
];

describe("weekly habit report", () => {
  it("uses the previous complete Denver week across DST and year boundaries", () => {
    expect(previousReportWeek(new Date("2026-11-02T15:00:00Z"))).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(previousReportWeek(new Date("2026-03-09T14:00:00Z"))).toEqual({ start: "2026-03-02", end: "2026-03-08" });
    expect(previousReportWeek(new Date("2026-11-02T06:30:00Z"))).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(previousReportWeek(new Date("2027-01-04T15:00:00Z"))).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });
  it("includes only selected active goals and counts minimum and zero miles", () => {
    const report = buildWeeklyReport(goals, entries, ["goal-miles"], now);
    expect(report.completed).toBe(1);
    expect(report.expected).toBe(7);
    expect(report.html).toContain("Miles run");
    expect(report.html).not.toContain("Flash cards");
    expect(report.text).toContain("0 miles total");
    expect(buildWeeklyReport(goals.map((goal) => ({ ...goal, active: false })), entries, ["goal-miles"], now).goalCount).toBe(0);
  });
  it("treats weight as a trend and excludes it from completion", () => {
    const report = buildWeeklyReport(goals, entries, ["goal-miles", "goal-weight"], now);
    expect(report.expected).toBe(7);
    expect(report.text).toContain("180.5 lbs / -0.5 since previous measurement");
    expect(buildWeeklyReport(goals, entries, ["goal-weight"], now).expected).toBe(0);
  });
  it("counts weekly habits once and calculates streaks through the report end", () => {
    const weeklyGoal = { ...goals[1], cadence: "weekly" as const };
    const report = buildWeeklyReport([weeklyGoal], [
      { goalId: weeklyGoal.id, periodDate: "2026-11-02", status: "minimum", value: null },
      { goalId: weeklyGoal.id, periodDate: "2026-10-26", status: "normal", value: null },
      { goalId: weeklyGoal.id, periodDate: "2026-11-09", status: "exceeds", value: null },
    ], [weeklyGoal.id], now);
    expect(report.expected).toBe(1);
    expect(report.completed).toBe(1);
    expect(report.text).toContain("2 week streak");
  });
  it("escapes user-entered content and supplies a readable plain-text version", () => {
    const goal = { ...goals[0], title: '<img src=x onerror="alert(1)">', description: "A & B" };
    const report = buildWeeklyReport([goal], [], [goal.id], now);
    expect(report.html).not.toContain("<img");
    expect(report.html).toContain("&lt;img");
    expect(report.html).toContain("A &amp; B");
    expect(report.text).toContain(goal.title);
    expect(report.html).not.toContain("NaN");
  });
  it("compares a daily trend against its previous measurement", () => {
    const trend = { ...goals[3], cadence: "daily" as const };
    const report = buildWeeklyReport([trend], [
      { goalId: trend.id, periodDate: "2026-11-03", status: "logged", value: 181 },
      { goalId: trend.id, periodDate: "2026-11-05", status: "logged", value: 180 },
    ], [trend.id], now);
    expect(report.text).toContain("-1 since previous measurement");
  });
});
