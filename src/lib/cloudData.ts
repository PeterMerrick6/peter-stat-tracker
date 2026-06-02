import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import type { AppData, DailyEntry, WeeklyEntry } from "../types";

const client = generateClient<Schema>();

export async function loadCloudData(): Promise<AppData> {
  const [dailyResult, weeklyResult] = await Promise.all([
    client.models.DailyEntry.list(),
    client.models.WeeklyEntry.list(),
  ]);

  throwOnAmplifyErrors(dailyResult.errors);
  throwOnAmplifyErrors(weeklyResult.errors);

  return {
    dailyEntries: dailyResult.data
      .map((entry) => ({
        entryDate: entry.entryDate,
        calories: entry.calories ?? null,
        flashcardsComplete: entry.flashcardsComplete ?? false,
        milesRun: entry.milesRun ?? null,
      }))
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    weeklyEntries: weeklyResult.data
      .map((entry) => ({
        weekStartDate: entry.weekStartDate,
        weightLbs: entry.weightLbs ?? null,
      }))
      .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate)),
  };
}

export async function saveCloudDailyEntry(entry: DailyEntry, exists: boolean): Promise<void> {
  const result = exists
    ? await client.models.DailyEntry.update(entry)
    : await client.models.DailyEntry.create(entry);

  throwOnAmplifyErrors(result.errors);
}

export async function saveCloudWeeklyEntry(entry: WeeklyEntry, exists: boolean): Promise<void> {
  const result = exists
    ? await client.models.WeeklyEntry.update(entry)
    : await client.models.WeeklyEntry.create(entry);

  throwOnAmplifyErrors(result.errors);
}

function throwOnAmplifyErrors(errors: unknown): void {
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors.map((error) => getErrorMessage(error)).join("; "));
  }
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return String(error);
}
