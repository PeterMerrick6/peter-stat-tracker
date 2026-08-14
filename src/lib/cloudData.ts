import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import type { AppData, Goal, GoalEntry } from "../types";
import { createDefaultGoals, migrateLegacyEntries } from "./goals";

const client = generateClient<Schema>();

export async function loadCloudData(): Promise<AppData> {
  const [goalResult, goalEntryResult, dailyResult, weeklyResult] = await Promise.all([
    listAll((nextToken) => client.models.Goal.list({ nextToken })),
    listAll((nextToken) => client.models.GoalEntry.list({ nextToken })),
    listAll((nextToken) => client.models.DailyEntry.list({ nextToken })),
    listAll((nextToken) => client.models.WeeklyEntry.list({ nextToken })),
  ]);

  let goals = goalResult.map(fromCloudGoal);
  let goalEntries = goalEntryResult.map(fromCloudGoalEntry);
  const dailyEntries = dailyResult.map((entry) => ({
    entryDate: entry.entryDate,
    calories: entry.calories ?? null,
    flashcardsComplete: entry.flashcardsComplete ?? false,
    milesRun: entry.milesRun ?? null,
  }));
  const weeklyEntries = weeklyResult.map((entry) => ({
    weekStartDate: entry.weekStartDate,
    weightLbs: entry.weightLbs ?? null,
  }));

  if (goals.length === 0) {
    goals = createDefaultGoals();
    await Promise.all(goals.map((goal) => saveCloudGoal(goal, false)));
  }

  if (goalEntries.length === 0 && (dailyEntries.length > 0 || weeklyEntries.length > 0)) {
    goalEntries = migrateLegacyEntries(goals, dailyEntries, weeklyEntries);
    await Promise.all(goalEntries.map((entry) => saveCloudGoalEntry(entry, false)));
  }

  return {
    goals: goals.sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title)),
    goalEntries: goalEntries.sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.goalId.localeCompare(b.goalId)),
    dailyEntries: dailyEntries.sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    weeklyEntries: weeklyEntries.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate)),
  };
}

export async function saveCloudGoal(goal: Goal, exists: boolean): Promise<void> {
  const payload = toCloudGoal(goal);
  const result = exists
    ? await client.models.Goal.update(payload)
    : await client.models.Goal.create(payload);

  throwOnAmplifyErrors(result.errors);
}

export async function deleteCloudGoal(goalId: string): Promise<void> {
  const result = await client.models.Goal.delete({ id: goalId });
  throwOnAmplifyErrors(result.errors);
}

export async function saveCloudGoalEntry(entry: GoalEntry, exists: boolean): Promise<void> {
  const payload = toCloudGoalEntry(entry);
  const result = exists
    ? await client.models.GoalEntry.update(payload)
    : await client.models.GoalEntry.create(payload);

  throwOnAmplifyErrors(result.errors);
}

export async function deleteCloudGoalEntry(entry: GoalEntry): Promise<void> {
  const result = await client.models.GoalEntry.delete({
    goalId: entry.goalId,
    periodDate: entry.periodDate,
  });
  throwOnAmplifyErrors(result.errors);
}

export async function deleteCloudGoalEntries(goalId: string, entries: GoalEntry[]): Promise<void> {
  await Promise.all(
    entries
      .filter((entry) => entry.goalId === goalId)
      .map((entry) => deleteCloudGoalEntry(entry)),
  );
}

async function listAll<T>(
  listPage: (nextToken?: string) => Promise<{ data: T[]; errors?: unknown; nextToken?: string | null }>,
): Promise<T[]> {
  const items: T[] = [];
  let nextToken: string | undefined;

  do {
    const result = await listPage(nextToken);
    throwOnAmplifyErrors(result.errors);
    items.push(...result.data);
    nextToken = result.nextToken ?? undefined;
  } while (nextToken);

  return items;
}

function fromCloudGoal(goal: Schema["Goal"]["type"]): Goal {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    type: goal.type ? (goal.type.toLowerCase() as Goal["type"]) : "status",
    cadence: goal.cadence ? (goal.cadence.toLowerCase() as Goal["cadence"]) : "daily",
    unit: goal.unit ?? "",
    targetDirection: fromCloudDirection(goal.targetDirection),
    minimumThreshold: goal.minimumThreshold ?? null,
    normalThreshold: goal.normalThreshold ?? null,
    exceedsThreshold: goal.exceedsThreshold ?? null,
    active: goal.active ?? true,
    displayOrder: goal.displayOrder ?? 0,
    archivedAt: goal.archivedAt ?? null,
  };
}

function fromCloudGoalEntry(entry: Schema["GoalEntry"]["type"]): GoalEntry {
  return {
    goalId: entry.goalId,
    periodDate: entry.periodDate,
    value: entry.value ?? null,
    status: entry.status ? (entry.status.toLowerCase() as GoalEntry["status"]) : null,
  };
}

function toCloudGoal(goal: Goal) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    type: goal.type.toUpperCase() as "STATUS" | "NUMERIC" | "TREND",
    cadence: goal.cadence.toUpperCase() as "DAILY" | "WEEKLY",
    unit: goal.unit,
    targetDirection: toCloudDirection(goal.targetDirection),
    minimumThreshold: goal.minimumThreshold,
    normalThreshold: goal.normalThreshold,
    exceedsThreshold: goal.exceedsThreshold,
    active: goal.active,
    displayOrder: goal.displayOrder,
    archivedAt: goal.archivedAt,
  };
}

function toCloudGoalEntry(entry: GoalEntry) {
  return {
    goalId: entry.goalId,
    periodDate: entry.periodDate,
    value: entry.value,
    status: entry.status ? (entry.status.toUpperCase() as "MINIMUM" | "NORMAL" | "EXCEEDS" | "LOGGED") : null,
  };
}

function fromCloudDirection(direction: Schema["Goal"]["type"]["targetDirection"]): Goal["targetDirection"] {
  if (direction === "AT_LEAST") return "atLeast";
  if (direction === "AT_MOST") return "atMost";
  return "none";
}

function toCloudDirection(direction: Goal["targetDirection"]): "AT_LEAST" | "AT_MOST" | "NONE" {
  if (direction === "atLeast") return "AT_LEAST";
  if (direction === "atMost") return "AT_MOST";
  return "NONE";
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
