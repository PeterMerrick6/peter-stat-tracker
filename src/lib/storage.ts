import type { AppData, DailyEntry, WeeklyEntry } from "../types";
import { addDays, getMondayWeekStart, todayInDenver } from "./date";

const STORAGE_KEY = "peter-daily:v1";

const demoDailyEntries: DailyEntry[] = [
  { entryDate: addDays(todayInDenver(), -6), calories: 1885, flashcardsComplete: true, milesRun: 3.2 },
  { entryDate: addDays(todayInDenver(), -5), calories: 2040, flashcardsComplete: true, milesRun: 0 },
  { entryDate: addDays(todayInDenver(), -4), calories: 1910, flashcardsComplete: true, milesRun: 4 },
  { entryDate: addDays(todayInDenver(), -3), calories: 1810, flashcardsComplete: false, milesRun: 2.25 },
  { entryDate: addDays(todayInDenver(), -2), calories: 1935, flashcardsComplete: true, milesRun: 0 },
  { entryDate: addDays(todayInDenver(), -1), calories: 1870, flashcardsComplete: true, milesRun: 5.1 },
];

const demoWeeklyEntries: WeeklyEntry[] = [
  { weekStartDate: addDays(getMondayWeekStart(todayInDenver()), -21), weightLbs: 184.8 },
  { weekStartDate: addDays(getMondayWeekStart(todayInDenver()), -14), weightLbs: 183.9 },
  { weekStartDate: addDays(getMondayWeekStart(todayInDenver()), -7), weightLbs: 183.4 },
];

export function loadAppData(): AppData {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return {
      dailyEntries: demoDailyEntries,
      weeklyEntries: demoWeeklyEntries,
    };
  }

  try {
    return JSON.parse(stored) as AppData;
  } catch {
    return {
      dailyEntries: [],
      weeklyEntries: [],
    };
  }
}

export function saveAppData(data: AppData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
