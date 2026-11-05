import { mkdirSync, writeFileSync } from "node:fs";
import { createDefaultGoals } from "../src/lib/goals";
import { buildWeeklyReport, previousReportWeek } from "../src/lib/weeklyReport";
import { addDays } from "../src/lib/date";
import type { GoalEntry, GoalStatus } from "../src/types";

const now = new Date();
const week = previousReportWeek(now);
const goals = createDefaultGoals();
const entries: GoalEntry[] = [];
const statuses: GoalStatus[] = ["normal", "normal", "minimum", "exceeds", "normal", "exceeds", "minimum"];
for (let index = 0; index < 7; index += 1) {
  const periodDate = addDays(week.start, index);
  entries.push({ goalId: "goal-calories", periodDate, value: [1900, 1875, 2100, 1750, 1920, 1780, 2000][index], status: statuses[index] });
  if (index !== 4) entries.push({ goalId: "goal-flashcards", periodDate, value: null, status: statuses[index] });
  entries.push({ goalId: "goal-miles", periodDate, value: [3.2, 0, 4.5, 5, 0, 6.2, 3][index], status: statuses[index] });
}
entries.push({ goalId: "goal-weight", periodDate: week.start, value: 180.5, status: "logged" });
entries.push({ goalId: "goal-weight", periodDate: addDays(week.start, -7), value: 181.2, status: "logged" });
const report = buildWeeklyReport(goals, entries, goals.map((goal) => goal.id), now);
mkdirSync("artifacts/reports", { recursive: true });
writeFileSync("artifacts/reports/weekly-report-preview.html", report.html);
console.log("artifacts/reports/weekly-report-preview.html");
