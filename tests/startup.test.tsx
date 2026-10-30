// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppExperience } from "../src/App";
import { createDefaultGoals } from "../src/lib/goals";
import { buildWidgetSnapshot, loadWidgetGoalIds } from "../src/lib/widgetData";

const { loadCloudData, saveSnapshot } = vi.hoisted(() => ({
  loadCloudData: vi.fn(),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ saveSnapshot }),
}));

const selectionKey = "peter-daily-widget-goal-ids";
const goals = [
  ...createDefaultGoals().slice(0, 2),
  { ...createDefaultGoals()[0], id: "custom-reading", title: "Reading", type: "status" as const },
];
const selectedIds = goals.map((goal) => goal.id);
const cloudData = { goals, goalEntries: [], dailyEntries: [], weeklyEntries: [] };

async function settle() {
  await act(async () => { await vi.dynamicImportSettled(); });
}

function openApp() {
  return render(<StrictMode><AppExperience storageMode="Cloud data" useCloudData loadData={loadCloudData} /></StrictMode>);
}

beforeEach(() => {
  vi.clearAllMocks();
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    clear: () => stored.clear(),
  });
  localStorage.clear();
  localStorage.setItem(selectionKey, JSON.stringify(selectedIds));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps saved choices and the native widget untouched while loading and after failure", async () => {
  loadCloudData.mockRejectedValue(new Error("No data"));
  openApp();
  await settle();
  expect(screen.queryByRole("heading", { name: "Calories" })).toBeNull();
  expect(saveSnapshot).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4500 });
  expect(screen.getByRole("alert").textContent).toContain("tracker selections have been kept");
  expect(localStorage.getItem(selectionKey)).toBe(JSON.stringify(selectedIds));
  expect(saveSnapshot).not.toHaveBeenCalled();
});

it("recovers via Retry without restarting and restores all three custom selections", async () => {
  loadCloudData.mockRejectedValue(new Error("No data"));
  openApp();
  await settle();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4500 });
  loadCloudData.mockResolvedValue(cloudData);
  fireEvent.click(screen.getByRole("button", { name: "Retry loading data" }));
  await settle();
  expect(screen.queryByRole("alert")).toBeNull();
  const snapshots = saveSnapshot.mock.calls.map(([options]) => JSON.parse(options.snapshot));
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.every((snapshot) => snapshot.goals.map((goal: { id: string }) => goal.id).join() === selectedIds.join())).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getAllByRole("checkbox").filter((element) => (element as HTMLInputElement).checked)).toHaveLength(3);
});

it("automatically retries a temporary startup failure", async () => {
  loadCloudData.mockRejectedValue(new Error("Temporary connection failure"));
  openApp();
  await settle();
  loadCloudData.mockResolvedValue(cloudData);
  await waitFor(() => expect(saveSnapshot).toHaveBeenCalled(), { timeout: 2500 });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("Loading cloud data...")).toBeNull();
  expect(saveSnapshot).toHaveBeenCalled();
});

it("preserves custom tracker choices when reopening after a failed startup", async () => {
  loadCloudData.mockRejectedValue(new Error("No data"));
  const first = openApp();
  await settle();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 4500 });
  first.unmount();
  loadCloudData.mockResolvedValue(cloudData);
  openApp();
  await settle();
  expect(localStorage.getItem(selectionKey)).toBe(JSON.stringify(selectedIds));
  await waitFor(() => expect(saveSnapshot).toHaveBeenCalled());
  expect(JSON.parse(saveSnapshot.mock.lastCall![0].snapshot).goals.map((goal: { id: string }) => goal.id)).toEqual(selectedIds);
});

it("cancels delayed retries when the app closes", async () => {
  loadCloudData.mockRejectedValue(new Error("No data"));
  const app = openApp();
  await settle();
  const attempts = loadCloudData.mock.calls.length;
  app.unmount();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(loadCloudData).toHaveBeenCalledTimes(attempts);
  expect(saveSnapshot).not.toHaveBeenCalled();
});

it("honors an explicitly empty widget selection", () => {
  localStorage.setItem(selectionKey, "[]");
  expect(loadWidgetGoalIds(goals)).toEqual([]);
  expect(buildWidgetSnapshot(goals, [], []).goals).toEqual([]);
});
