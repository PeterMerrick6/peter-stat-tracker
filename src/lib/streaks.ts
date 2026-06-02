import type { DailyEntry, Streak, WeeklyEntry } from "../types";
import { addDays, addWeeks, getMondayWeekStart, todayInDenver } from "./date";

const CALORIE_LIMIT = 1950;

type DailyPredicate = (entry: DailyEntry) => boolean;
type WeeklyPredicate = (entry: WeeklyEntry) => boolean;
type OptionalDailyPredicate = (entry: DailyEntry | undefined) => boolean;
type OptionalWeeklyPredicate = (entry: WeeklyEntry | undefined) => boolean;

export function buildStreaks(dailyEntries: DailyEntry[], weeklyEntries: WeeklyEntry[]): Streak[] {
  const dailyByDate = new Map(dailyEntries.map((entry) => [entry.entryDate, entry]));
  const weeklyByDate = new Map(weeklyEntries.map((entry) => [entry.weekStartDate, entry]));
  const today = todayInDenver();
  const thisWeek = getMondayWeekStart(today);

  return [
    {
      label: "Calories logged",
      current: currentDailyStreak(dailyByDate, today, (entry) => entry?.calories !== null && entry?.calories !== undefined),
      longest: longestDailyStreak(dailyEntries, (entry) => entry.calories !== null && entry.calories !== undefined),
      unit: "days",
      accent: "gold",
    },
    {
      label: "Under 1,950",
      current: currentDailyStreak(dailyByDate, today, (entry) => typeof entry?.calories === "number" && entry.calories <= CALORIE_LIMIT),
      longest: longestDailyStreak(dailyEntries, (entry) => typeof entry.calories === "number" && entry.calories <= CALORIE_LIMIT),
      unit: "days",
      accent: "green",
    },
    {
      label: "Flash cards",
      current: currentDailyStreak(dailyByDate, today, (entry) => entry?.flashcardsComplete === true),
      longest: longestDailyStreak(dailyEntries, (entry) => entry.flashcardsComplete),
      unit: "days",
      accent: "teal",
    },
    {
      label: "Miles logged",
      current: currentDailyStreak(dailyByDate, today, (entry) => entry?.milesRun !== null && entry?.milesRun !== undefined),
      longest: longestDailyStreak(dailyEntries, (entry) => entry.milesRun !== null && entry.milesRun !== undefined),
      unit: "days",
      accent: "coral",
    },
    {
      label: "Monday weigh-in",
      current: currentWeeklyStreak(weeklyByDate, thisWeek, (entry) => entry?.weightLbs !== null && entry?.weightLbs !== undefined),
      longest: longestWeeklyStreak(weeklyEntries, (entry) => entry.weightLbs !== null && entry.weightLbs !== undefined),
      unit: "weeks",
      accent: "ink",
    },
  ];
}

function currentDailyStreak(entries: Map<string, DailyEntry>, startDate: string, qualifies: OptionalDailyPredicate): number {
  let count = 0;
  let cursor = startDate;

  while (qualifies(entries.get(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

function longestDailyStreak(entries: DailyEntry[], qualifies: DailyPredicate): number {
  const qualifyingDates = new Set(entries.filter(qualifies).map((entry) => entry.entryDate));
  return longestConsecutive(qualifyingDates, -1, addDays);
}

function currentWeeklyStreak(entries: Map<string, WeeklyEntry>, startWeek: string, qualifies: OptionalWeeklyPredicate): number {
  let count = 0;
  let cursor = startWeek;

  while (qualifies(entries.get(cursor))) {
    count += 1;
    cursor = addWeeks(cursor, -1);
  }

  return count;
}

function longestWeeklyStreak(entries: WeeklyEntry[], qualifies: WeeklyPredicate): number {
  const qualifyingWeeks = new Set(entries.filter(qualifies).map((entry) => entry.weekStartDate));
  return longestConsecutive(qualifyingWeeks, -1, addWeeks);
}

function longestConsecutive(values: Set<string>, step: number, move: (date: string, amount: number) => string): number {
  let longest = 0;

  for (const value of values) {
    const previous = move(value, step);
    if (values.has(previous)) {
      continue;
    }

    let cursor = value;
    let current = 0;
    while (values.has(cursor)) {
      current += 1;
      cursor = move(cursor, -step);
    }

    longest = Math.max(longest, current);
  }

  return longest;
}
