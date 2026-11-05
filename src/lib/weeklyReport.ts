import type { Goal, GoalEntry, GoalStatus } from "../types";
import { addDays, addWeeks, dateToDenverString, getMondayWeekStart } from "./date";
import { getGoalEntryKey, isGoalEntryComplete, sortGoals } from "./goals";

export function previousReportWeek(now = new Date()) {
  const start = addWeeks(getMondayWeekStart(dateToDenverString(now)), -1);
  return { start, end: addDays(start, 6) };
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

const colors: Record<GoalStatus | "open", string> = {
  minimum: "#e9b949", normal: "#3d7f6b", exceeds: "#79a76b", logged: "#8395a3", open: "#e5e7eb",
};
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));

export function buildWeeklyReport(goals: Goal[], entries: GoalEntry[], goalIds: string[], now = new Date()) {
  const { start, end } = previousReportWeek(now);
  const selected = sortGoals(goals).filter((goal) => goalIds.includes(goal.id) && goal.active && !goal.archivedAt);
  const byKey = new Map(entries.map((entry) => [getGoalEntryKey(entry.goalId, entry.periodDate), entry]));
  let completed = 0;
  let expected = 0;
  const textRows: string[] = [];
  const rows = selected.map((goal) => {
    const periods = goal.cadence === "weekly" ? [start] : Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const weekEntries = periods.map((period) => byKey.get(getGoalEntryKey(goal.id, period)));
    const done = weekEntries.filter(isGoalEntryComplete).length;
    const values = weekEntries.flatMap((entry) => entry?.value !== null && entry?.value !== undefined ? [entry.value] : []);
    const history = entries.filter((entry) => entry.goalId === goal.id && entry.periodDate <= end && entry.value !== null)
      .sort((a, b) => b.periodDate.localeCompare(a.periodDate));
    let streak = 0;
    let cursor = goal.cadence === "weekly" ? start : end;
    while (isGoalEntryComplete(byKey.get(getGoalEntryKey(goal.id, cursor)))) {
      streak += 1;
      cursor = goal.cadence === "weekly" ? addWeeks(cursor, -1) : addDays(cursor, -1);
    }
    let metric: string;
    if (goal.type === "trend") {
      const measured = weekEntries.filter((entry): entry is GoalEntry => entry !== undefined && entry.value !== null);
      const latestEntry = measured[measured.length - 1];
      const latest = latestEntry?.value ?? undefined;
      const previous = latestEntry ? history.find((entry) => entry.periodDate < latestEntry.periodDate) : undefined;
      const delta = latest !== undefined && previous ? latest - previous.value! : null;
      metric = latest === undefined ? "No measurement this week" : `${number(latest)} ${goal.unit}${delta === null ? "" : ` / ${delta > 0 ? "+" : ""}${number(delta)} since previous measurement`}`;
    } else {
      completed += done;
      expected += periods.length;
      metric = `${done} of ${periods.length} ${goal.cadence === "weekly" ? "week" : "days"} complete / ${streak} ${goal.cadence === "weekly" ? "week" : "day"} streak`;
      if (values.length) {
        const total = values.reduce((sum, value) => sum + value, 0);
        metric += ` / average ${number(total / values.length)} ${goal.unit}`;
        if (goal.unit.toLowerCase() === "miles") metric += ` / ${number(total)} miles total`;
      }
    }
    const cells = periods.map((period, index) => {
      const entry = weekEntries[index];
      const status = entry?.status ?? "open";
      const label = entry?.status ?? (entry?.value !== null && entry?.value !== undefined ? "Below minimum" : "Not logged");
      const value = entry?.value !== null && entry?.value !== undefined ? number(entry.value) : "";
      const shortStatus = { minimum: "Min", normal: "Norm", exceeds: "Excd", logged: "Logged" };
      const caption = value || (entry?.status ? shortStatus[entry.status] : "-");
      const day = goal.cadence === "weekly" ? "Week" : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index];
      return `<td align="center" style="padding:3px;width:${100 / periods.length}%;word-break:break-word"><div style="font-size:11px;color:#66736b;margin-bottom:5px">${day}</div><div title="${escape(period + ": " + label)}" style="height:28px;background:${colors[status]};border-radius:4px"></div><div style="font-size:11px;margin-top:5px">${escape(caption)}</div></td>`;
    }).join("");
    textRows.push(`${goal.title}: ${metric}\n${periods.map((period, index) => `${period}: ${weekEntries[index]?.value ?? ""} ${weekEntries[index]?.status ?? "not complete"}`).join("\n")}`);
    return `<tr><td style="padding:24px 28px;border-bottom:1px solid #e6ebe7"><h2 style="font-size:19px;margin:0 0 6px;color:#183c2f">${escape(goal.title)}</h2>${goal.description ? `<p style="font-size:13px;color:#66736b;margin:0 0 10px">${escape(goal.description)}</p>` : ""}<p style="font-size:13px;margin:0 0 16px">${escape(metric)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`;
  }).join("");
  const rate = expected ? Math.round(completed / expected * 100) : null;
  const range = `${dateLabel(start)} - ${dateLabel(end)}, ${end.slice(0, 4)}`;
  const summary = rate === null ? "Your weekly measurements" : `${rate}% complete / ${completed} of ${expected} habit check-ins`;
  const subject = `Peter-Daily / Weekly report / ${range}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#f0f3f1;color:#24382d;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(summary)}. A look at your week.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:white;border-radius:8px;overflow:hidden"><tr><td style="padding:30px 28px;background:#183c2f;color:white"><p style="font-size:14px;margin:0 0 20px;color:#b9d8c7;font-weight:bold">Peter-Daily</p><h1 style="margin:0 0 10px;font-size:30px">Your week in habits</h1><p style="margin:0;font-size:15px;color:#d8e9df">${range}</p></td></tr><tr><td style="padding:24px 28px;background:#eef6f1"><p style="font-size:25px;font-weight:bold;margin:0 0 6px">${rate === null ? "Trend check-in" : `${rate}% complete`}</p><p style="margin:0;font-size:14px">${rate === null ? "A little perspective on your progress." : `${completed} of ${expected} habit check-ins completed. Minimum counts.`}</p></td></tr>${rows || '<tr><td style="padding:28px">No active habits selected for this report.</td></tr>'}<tr><td style="padding:20px 28px;font-size:12px;color:#66736b;line-height:1.8"><span style="color:#9b7400">Minimum</span> &middot; <span style="color:#3d7f6b">Normal</span> &middot; <span style="color:#527d41">Exceeds</span> &middot; Logged &middot; Not logged<br>Weight and other trend metrics are separate from completion.<br>Sent Mondays at 8:00 AM, America/Denver. Manage recipient, habits, or pause emails in Peter-Daily Settings.</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text: `${subject}\n\n${summary}\n\n${textRows.join("\n\n")}\n\nManage weekly emails in Peter-Daily Settings.`, start, end, completed, expected, goalCount: selected.length };
}
