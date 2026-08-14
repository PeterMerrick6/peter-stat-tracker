import type { Goal, GoalEntry, Streak } from "../types";
import { addDays, addWeeks, getMondayWeekStart, todayInDenver } from "./date";
import { getGoalEntryKey, isGoalEntryComplete, sortGoals } from "./goals";

export function buildStreaks(goals: Goal[], goalEntries: GoalEntry[]): Streak[] {
  const entriesByKey = new Map(goalEntries.map((entry) => [getGoalEntryKey(entry.goalId, entry.periodDate), entry]));
  const today = todayInDenver();

  return sortGoals(goals)
    .filter((goal) => goal.active && !goal.archivedAt)
    .map((goal, index) => {
      const startPeriod = goal.cadence === "weekly" ? getMondayWeekStart(today) : today;
      const move = goal.cadence === "weekly" ? addWeeks : addDays;
      const unit = goal.cadence === "weekly" ? "weeks" : "days";

      return {
        label: goal.title,
        current: currentStreak(goal, entriesByKey, startPeriod, move),
        longest: longestStreak(goal, goalEntries, move),
        unit,
        accent: ["gold", "teal", "coral", "green", "ink"][index % 5] as Streak["accent"],
      };
    });
}

function currentStreak(
  goal: Goal,
  entriesByKey: Map<string, GoalEntry>,
  startPeriod: string,
  move: (date: string, amount: number) => string,
): number {
  let count = 0;
  let cursor = startPeriod;

  while (isGoalEntryComplete(entriesByKey.get(getGoalEntryKey(goal.id, cursor)))) {
    count += 1;
    cursor = move(cursor, -1);
  }

  return count;
}

function longestStreak(goal: Goal, entries: GoalEntry[], move: (date: string, amount: number) => string): number {
  const qualifyingPeriods = new Set(
    entries
      .filter((entry) => entry.goalId === goal.id && isGoalEntryComplete(entry))
      .map((entry) => entry.periodDate),
  );
  let longest = 0;

  for (const period of qualifyingPeriods) {
    if (qualifyingPeriods.has(move(period, -1))) {
      continue;
    }

    let cursor = period;
    let current = 0;
    while (qualifyingPeriods.has(cursor)) {
      current += 1;
      cursor = move(cursor, 1);
    }

    longest = Math.max(longest, current);
  }

  return longest;
}
