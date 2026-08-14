import type { DailyEntry, Goal, GoalEntry, GoalStatus, WeeklyEntry } from "../types";
import { getMondayWeekStart } from "./date";

export const STATUS_COLORS: Record<GoalStatus, string> = {
  minimum: "minimum",
  normal: "normal",
  exceeds: "exceeds",
  logged: "logged",
};

export function createDefaultGoals(): Goal[] {
  return [
    {
      id: "goal-calories",
      title: "Calories",
      description: "Stay close to the daily calorie target.",
      type: "numeric",
      cadence: "daily",
      unit: "calories",
      targetDirection: "atMost",
      minimumThreshold: 2200,
      normalThreshold: 1950,
      exceedsThreshold: 1800,
      active: true,
      displayOrder: 10,
      archivedAt: null,
    },
    {
      id: "goal-flashcards",
      title: "Flash cards",
      description: "Complete the day review.",
      type: "status",
      cadence: "daily",
      unit: "",
      targetDirection: "none",
      minimumThreshold: null,
      normalThreshold: null,
      exceedsThreshold: null,
      active: true,
      displayOrder: 20,
      archivedAt: null,
    },
    {
      id: "goal-miles",
      title: "Miles run",
      description: "Log training miles, including rest days.",
      type: "numeric",
      cadence: "daily",
      unit: "miles",
      targetDirection: "atLeast",
      minimumThreshold: 0,
      normalThreshold: 3,
      exceedsThreshold: 5,
      active: true,
      displayOrder: 30,
      archivedAt: null,
    },
    {
      id: "goal-weight",
      title: "Weight",
      description: "Weekly trend metric.",
      type: "trend",
      cadence: "weekly",
      unit: "lbs",
      targetDirection: "none",
      minimumThreshold: null,
      normalThreshold: null,
      exceedsThreshold: null,
      active: true,
      displayOrder: 40,
      archivedAt: null,
    },
  ];
}

export function getGoalPeriodDate(goal: Goal, selectedDate: string): string {
  return goal.cadence === "weekly" ? getMondayWeekStart(selectedDate) : selectedDate;
}

export function getGoalEntryKey(goalId: string, periodDate: string): string {
  return `${goalId}:${periodDate}`;
}

export function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
}

export function calculateNumericStatus(goal: Goal, value: number | null): GoalStatus | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (goal.type === "trend") {
    return "logged";
  }

  if (goal.type !== "numeric") {
    return null;
  }

  const minimum = goal.minimumThreshold;
  const normal = goal.normalThreshold;
  const exceeds = goal.exceedsThreshold;

  if (goal.targetDirection === "atLeast") {
    if (exceeds !== null && value >= exceeds) return "exceeds";
    if (normal !== null && value >= normal) return "normal";
    if (minimum !== null && value >= minimum) return "minimum";
    return null;
  }

  if (goal.targetDirection === "atMost") {
    if (exceeds !== null && value <= exceeds) return "exceeds";
    if (normal !== null && value <= normal) return "normal";
    if (minimum !== null && value <= minimum) return "minimum";
    return null;
  }

  return "logged";
}

export function isGoalEntryComplete(entry: GoalEntry | undefined): boolean {
  return entry?.status === "minimum" || entry?.status === "normal" || entry?.status === "exceeds" || entry?.status === "logged";
}

export function migrateLegacyEntries(goals: Goal[], dailyEntries: DailyEntry[], weeklyEntries: WeeklyEntry[]): GoalEntry[] {
  const entries = new Map<string, GoalEntry>();
  const byId = new Map(goals.map((goal) => [goal.id, goal]));

  for (const daily of dailyEntries) {
    const calories = byId.get("goal-calories");
    if (calories && daily.calories !== null && daily.calories !== undefined) {
      addEntry(entries, {
        goalId: calories.id,
        periodDate: daily.entryDate,
        value: daily.calories,
        status: calculateNumericStatus(calories, daily.calories),
      });
    }

    const flashcards = byId.get("goal-flashcards");
    if (flashcards && daily.flashcardsComplete) {
      addEntry(entries, {
        goalId: flashcards.id,
        periodDate: daily.entryDate,
        value: null,
        status: "normal",
      });
    }

    const miles = byId.get("goal-miles");
    if (miles && daily.milesRun !== null && daily.milesRun !== undefined) {
      addEntry(entries, {
        goalId: miles.id,
        periodDate: daily.entryDate,
        value: daily.milesRun,
        status: calculateNumericStatus(miles, daily.milesRun),
      });
    }
  }

  const weight = byId.get("goal-weight");
  if (weight) {
    for (const weekly of weeklyEntries) {
      if (weekly.weightLbs !== null && weekly.weightLbs !== undefined) {
        addEntry(entries, {
          goalId: weight.id,
          periodDate: weekly.weekStartDate,
          value: weekly.weightLbs,
          status: "logged",
        });
      }
    }
  }

  return [...entries.values()].sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.goalId.localeCompare(b.goalId));
}

function addEntry(entries: Map<string, GoalEntry>, entry: GoalEntry): void {
  entries.set(getGoalEntryKey(entry.goalId, entry.periodDate), entry);
}
