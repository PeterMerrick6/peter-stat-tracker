import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Goal, GoalEntry, GoalStatus } from "../types";
import { addDays, addWeeks, getMondayWeekStart, todayInDenver } from "./date";
import { getGoalEntryKey, getGoalPeriodDate, isGoalEntryComplete, sortGoals } from "./goals";

const WIDGET_GOAL_IDS_KEY = "peter-daily-widget-goal-ids";
const WIDGET_GOAL_LIMIT = 3;
const WIDGET_DAY_COUNT = 7;

type WidgetDataPlugin = {
  saveSnapshot(options: { snapshot: string }): Promise<void>;
};

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

export type WidgetGoalSnapshot = {
  id: string;
  title: string;
  streak: number;
  statuses: (GoalStatus | null)[];
};

export type WidgetSnapshot = {
  updatedAt: string;
  goals: WidgetGoalSnapshot[];
};

export function loadWidgetGoalIds(goals: Goal[]): string[] {
  const activeGoalIds = getDefaultWidgetGoalIds(goals);
  const saved = window.localStorage.getItem(WIDGET_GOAL_IDS_KEY);

  if (!saved) {
    return activeGoalIds;
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return activeGoalIds;
    }

    const activeIds = new Set(sortGoals(goals).filter((goal) => goal.active && !goal.archivedAt).map((goal) => goal.id));
    const selected = parsed
      .filter((goalId): goalId is string => typeof goalId === "string" && activeIds.has(goalId))
      .slice(0, WIDGET_GOAL_LIMIT);

    return selected.length ? selected : activeGoalIds;
  } catch {
    return activeGoalIds;
  }
}

export function saveWidgetGoalIds(goalIds: string[]): void {
  window.localStorage.setItem(WIDGET_GOAL_IDS_KEY, JSON.stringify(goalIds.slice(0, WIDGET_GOAL_LIMIT)));
}

export function buildWidgetSnapshot(goals: Goal[], entries: GoalEntry[], selectedGoalIds: string[]): WidgetSnapshot {
  const activeGoals = sortGoals(goals).filter((goal) => goal.active && !goal.archivedAt);
  const selectedIds = selectedGoalIds.length ? selectedGoalIds : getDefaultWidgetGoalIds(activeGoals);
  const selectedGoals = selectedIds
    .map((goalId) => activeGoals.find((goal) => goal.id === goalId))
    .filter((goal): goal is Goal => Boolean(goal))
    .slice(0, WIDGET_GOAL_LIMIT);
  const entriesByKey = new Map(entries.map((entry) => [getGoalEntryKey(entry.goalId, entry.periodDate), entry]));
  const today = todayInDenver();
  const days = Array.from({ length: WIDGET_DAY_COUNT }, (_, index) => addDays(today, index - WIDGET_DAY_COUNT + 1));

  return {
    updatedAt: new Date().toISOString(),
    goals: selectedGoals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      streak: getCurrentStreak(goal, entriesByKey, today),
      statuses: days.map((day) => entriesByKey.get(getGoalEntryKey(goal.id, getGoalPeriodDate(goal, day)))?.status ?? null),
    })),
  };
}

export async function saveAndroidWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await WidgetData.saveSnapshot({
    snapshot: JSON.stringify(snapshot),
  });
}

export function getWidgetGoalLimit(): number {
  return WIDGET_GOAL_LIMIT;
}

function getDefaultWidgetGoalIds(goals: Goal[]): string[] {
  return sortGoals(goals)
    .filter((goal) => goal.active && !goal.archivedAt)
    .slice(0, WIDGET_GOAL_LIMIT)
    .map((goal) => goal.id);
}

function getCurrentStreak(goal: Goal, entriesByKey: Map<string, GoalEntry>, today: string): number {
  const move = goal.cadence === "weekly" ? addWeeks : addDays;
  let cursor = goal.cadence === "weekly" ? getMondayWeekStart(today) : today;
  let count = 0;

  while (isGoalEntryComplete(entriesByKey.get(getGoalEntryKey(goal.id, cursor)))) {
    count += 1;
    cursor = move(cursor, -1);
  }

  return count;
}
