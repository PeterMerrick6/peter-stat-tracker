import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  LogOut,
  Plus,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppData, Goal, GoalCadence, GoalEntry, GoalStatus, GoalTargetDirection, GoalType, Streak } from "./types";
import { addDays, formatFriendlyDate, getRecentDates, getRecentWeekStarts, todayInDenver } from "./lib/date";
import { loadAppData, saveAppData } from "./lib/storage";
import { buildStreaks } from "./lib/streaks";
import {
  calculateNumericStatus,
  createDefaultGoals,
  getGoalEntryKey,
  getGoalPeriodDate,
  isGoalEntryComplete,
  sortGoals,
} from "./lib/goals";

type Tab = "today" | "history" | "streaks" | "settings";

const amplifyOutputModules = import.meta.glob("../amplify_outputs.json", {
  eager: true,
  import: "default",
});
const amplifyOutputs = Object.values(amplifyOutputModules)[0];
const CloudShell = lazy(async () => {
  const [{ Amplify }, { Authenticator }] = await Promise.all([
    import("aws-amplify"),
    import("@aws-amplify/ui-react"),
    import("@aws-amplify/ui-react/styles.css"),
  ]);

  function CloudShellComponent({ outputs }: { outputs: unknown }) {
    Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);

    return (
      <Authenticator loginMechanisms={["email"]}>
        {({ signOut }) => <AppExperience signOut={signOut} storageMode="Cloud data" useCloudData />}
      </Authenticator>
    );
  }

  return { default: CloudShellComponent };
});

function App() {
  if (amplifyOutputs) {
    return (
      <Suspense fallback={<AppLoading />}>
        <CloudShell outputs={amplifyOutputs} />
      </Suspense>
    );
  }

  return <AppExperience storageMode="Local preview" />;
}

function AppLoading() {
  return (
    <div className="app-shell">
      <main className="phone-frame">
        <p className="eyebrow">Peter-Daily</p>
        <h1 className="loading-title">Loading</h1>
      </main>
    </div>
  );
}

function AppExperience({
  signOut,
  storageMode,
  useCloudData = false,
}: {
  signOut?: () => void;
  storageMode: string;
  useCloudData?: boolean;
}) {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState(todayInDenver());
  const [isCloudLoading, setIsCloudLoading] = useState(useCloudData);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!useCloudData) {
      saveAppData(data);
    }
  }, [data, useCloudData]);

  useEffect(() => {
    if (!useCloudData) {
      return;
    }

    let isActive = true;

    async function loadEntries() {
      try {
        setIsCloudLoading(true);
        setSyncError(null);
        const { loadCloudData } = await import("./lib/cloudData");
        const cloudData = await loadCloudData();

        if (isActive) {
          setData(cloudData);
        }
      } catch (error) {
        if (isActive) {
          setSyncError(getErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsCloudLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isActive = false;
    };
  }, [useCloudData]);

  const goals = useMemo(() => sortGoals(data.goals), [data.goals]);
  const activeGoals = goals.filter((goal) => goal.active && !goal.archivedAt);
  const entriesByKey = useMemo(
    () => new Map(data.goalEntries.map((entry) => [getGoalEntryKey(entry.goalId, entry.periodDate), entry])),
    [data.goalEntries],
  );
  const streaks = useMemo(() => buildStreaks(data.goals, data.goalEntries), [data.goals, data.goalEntries]);
  const todaySummary = getGoalSummary(activeGoals, entriesByKey, selectedDate, streaks);

  async function upsertGoal(goal: Goal) {
    const exists = data.goals.some((item) => item.id === goal.id);

    setData((current) => ({
      ...current,
      goals: [...current.goals.filter((item) => item.id !== goal.id), goal],
    }));

    if (useCloudData) {
      const { saveCloudGoal } = await import("./lib/cloudData");
      await saveCloudGoal(goal, exists);
    }
  }

  async function upsertGoalEntry(entry: GoalEntry) {
    const exists = data.goalEntries.some((item) => item.goalId === entry.goalId && item.periodDate === entry.periodDate);

    setData((current) => ({
      ...current,
      goalEntries: [
        ...current.goalEntries.filter((item) => !(item.goalId === entry.goalId && item.periodDate === entry.periodDate)),
        entry,
      ].sort((a, b) => a.periodDate.localeCompare(b.periodDate) || a.goalId.localeCompare(b.goalId)),
    }));

    if (useCloudData) {
      const { saveCloudGoalEntry } = await import("./lib/cloudData");
      await saveCloudGoalEntry(entry, exists);
    }
  }

  async function deleteGoalEntry(entry: GoalEntry) {
    const exists = data.goalEntries.some((item) => item.goalId === entry.goalId && item.periodDate === entry.periodDate);

    setData((current) => ({
      ...current,
      goalEntries: current.goalEntries.filter(
        (item) => !(item.goalId === entry.goalId && item.periodDate === entry.periodDate),
      ),
    }));

    if (useCloudData && exists) {
      const { deleteCloudGoalEntry } = await import("./lib/cloudData");
      await deleteCloudGoalEntry(entry);
    }
  }

  async function removeGoal(goalId: string) {
    const relatedEntries = data.goalEntries.filter((entry) => entry.goalId === goalId);

    setData((current) => ({
      ...current,
      goals: current.goals.filter((goal) => goal.id !== goalId),
      goalEntries: current.goalEntries.filter((entry) => entry.goalId !== goalId),
    }));

    if (useCloudData) {
      const { deleteCloudGoal, deleteCloudGoalEntries } = await import("./lib/cloudData");
      await deleteCloudGoalEntries(goalId, relatedEntries);
      await deleteCloudGoal(goalId);
    }
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <header className="top-bar">
          <div>
            <p className="eyebrow">America/Denver</p>
            <h1>Peter-Daily</h1>
          </div>
          <button className="icon-button" aria-label="Sign out" onClick={signOut} disabled={!signOut}>
            <LogOut size={20} />
          </button>
        </header>

        <section className="summary-strip" aria-label="Today summary">
          <div>
            <span>{todaySummary.completed}</span>
            <small>complete</small>
          </div>
          <div>
            <span>{todaySummary.total}</span>
            <small>active goals</small>
          </div>
          <div>
            <span>{todaySummary.bestStreak}</span>
            <small>best streak</small>
          </div>
        </section>

        {isCloudLoading && <p className="status-banner">Loading cloud data...</p>}
        {syncError && <p className="status-banner error">{syncError}</p>}

        {activeTab === "today" && (
          <TodayView
            selectedDate={selectedDate}
            goals={activeGoals}
            entriesByKey={entriesByKey}
            onDateChange={setSelectedDate}
            onSaveEntries={async (entries) => {
              for (const entry of entries) {
                if (isEmptyGoalEntry(entry)) {
                  await deleteGoalEntry(entry);
                } else {
                  await upsertGoalEntry(entry);
                }
              }
            }}
          />
        )}

        {activeTab === "history" && (
          <HistoryView
            goals={activeGoals}
            entriesByKey={entriesByKey}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveTab("today");
            }}
          />
        )}

        {activeTab === "streaks" && <StreaksView streaks={streaks} goals={activeGoals} entries={data.goalEntries} />}

        {activeTab === "settings" && (
          <SettingsView
            storageMode={storageMode}
            goals={goals}
            onSaveGoal={upsertGoal}
            onRemoveGoal={removeGoal}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton icon={<Home size={20} />} label="Today" active={activeTab === "today"} onClick={() => setActiveTab("today")} />
        <NavButton icon={<CalendarDays size={20} />} label="History" active={activeTab === "history"} onClick={() => setActiveTab("history")} />
        <NavButton icon={<Flame size={20} />} label="Streaks" active={activeTab === "streaks"} onClick={() => setActiveTab("streaks")} />
        <NavButton icon={<Settings size={20} />} label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
      </nav>
    </div>
  );
}

function TodayView({
  selectedDate,
  goals,
  entriesByKey,
  onDateChange,
  onSaveEntries,
}: {
  selectedDate: string;
  goals: Goal[];
  entriesByKey: Map<string, GoalEntry>;
  onDateChange: (date: string) => void;
  onSaveEntries: (entries: GoalEntry[]) => Promise<void> | void;
}) {
  const dailyGoals = goals.filter((goal) => goal.cadence === "daily");
  const weeklyGoals = goals.filter((goal) => goal.cadence === "weekly");
  const visibleGoals = [...dailyGoals, ...weeklyGoals];
  const visibleGoalSignature = visibleGoals
    .map((goal) => `${goal.id}:${getGoalPeriodDate(goal, selectedDate)}`)
    .join("|");
  const [draftEntries, setDraftEntries] = useState<Record<string, GoalEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const nextDrafts: Record<string, GoalEntry> = {};
    for (const goal of visibleGoals) {
      const periodDate = getGoalPeriodDate(goal, selectedDate);
      const key = getGoalEntryKey(goal.id, periodDate);
      nextDrafts[key] = entriesByKey.get(key) ?? {
        goalId: goal.id,
        periodDate,
        value: null,
        status: null,
      };
    }
    setDraftEntries(nextDrafts);
    setSaveError(null);
    setSaved(false);
  }, [entriesByKey, selectedDate, visibleGoalSignature]);

  function updateDraft(goal: Goal, entry: GoalEntry) {
    setDraftEntries((current) => ({
      ...current,
      [getGoalEntryKey(goal.id, entry.periodDate)]: entry,
    }));
    setSaved(false);
  }

  async function handleSaveAll() {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSaveEntries(Object.values(draftEntries));
      setSaved(true);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="screen">
      <div className="date-row">
        <button className="icon-button" aria-label="Previous day" onClick={() => onDateChange(addDays(selectedDate, -1))}>
          <ChevronLeft size={22} />
        </button>
        <label>
          <span>Date</span>
          <input type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <button className="icon-button" aria-label="Next day" onClick={() => onDateChange(addDays(selectedDate, 1))}>
          <ChevronRight size={22} />
        </button>
      </div>

      <GoalSection title="Daily" goals={dailyGoals} draftEntries={draftEntries} selectedDate={selectedDate} onChangeEntry={updateDraft} />
      <GoalSection title="Weekly" goals={weeklyGoals} draftEntries={draftEntries} selectedDate={selectedDate} onChangeEntry={updateDraft} />

      {saveError && <p className="status-banner error">{saveError}</p>}
      <button className="primary-action" onClick={handleSaveAll} disabled={isSaving || visibleGoals.length === 0}>
        {isSaving ? "Saving..." : saved ? "Saved all goals" : "Save all goals"}
      </button>
    </section>
  );
}

function GoalSection({
  title,
  goals,
  draftEntries,
  selectedDate,
  onChangeEntry,
}: {
  title: string;
  goals: Goal[];
  draftEntries: Record<string, GoalEntry>;
  selectedDate: string;
  onChangeEntry: (goal: Goal, entry: GoalEntry) => void;
}) {
  if (goals.length === 0) {
    return null;
  }

  return (
    <section className="goal-section">
      <div className="section-heading compact">
        <h2>{title}</h2>
      </div>
      {goals.map((goal) => {
        const periodDate = getGoalPeriodDate(goal, selectedDate);
        const key = getGoalEntryKey(goal.id, periodDate);
        const entry = draftEntries[key] ?? {
          goalId: goal.id,
          periodDate,
          value: null,
          status: null,
        };
        return <GoalCard key={goal.id} goal={goal} entry={entry} onChangeEntry={(nextEntry) => onChangeEntry(goal, nextEntry)} />;
      })}
    </section>
  );
}

function GoalCard({
  goal,
  entry,
  onChangeEntry,
}: {
  goal: Goal;
  entry: GoalEntry;
  onChangeEntry: (entry: GoalEntry) => void;
}) {
  const value = entry.value?.toString() ?? "";
  const displayStatus = entry.status;

  function updateStatus(status: GoalStatus) {
    onChangeEntry({
      ...entry,
      status,
      value: null,
    });
  }

  function updateValue(rawValue: string) {
    const numericValue = rawValue === "" ? null : Number(rawValue);
    const safeValue = Number.isFinite(numericValue) ? numericValue : null;
    onChangeEntry({
      ...entry,
      value: safeValue,
      status: calculateNumericStatus(goal, safeValue),
    });
  }

  function unlogEntry() {
    onChangeEntry({
      ...entry,
      value: null,
      status: null,
    });
  }

  return (
    <article className={`goal-card ${displayStatus ? `status-${displayStatus}` : ""}`}>
      <div className="goal-card-header">
        <div>
          <h3>{goal.title}</h3>
          <p>{goal.description}</p>
        </div>
        <StatusPill status={displayStatus} />
      </div>

      {goal.type === "status" ? (
        <StatusSelector value={displayStatus} onChange={updateStatus} />
      ) : (
        <label className="goal-input">
          <span>{goal.type === "trend" ? "Value" : "Progress"}</span>
          <div>
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step={goal.unit === "calories" ? "1" : "0.01"}
              value={value}
              onChange={(event) => updateValue(event.target.value)}
              placeholder={goal.unit || "value"}
            />
            {goal.unit && <small>{goal.unit}</small>}
          </div>
        </label>
      )}

      <button className="text-action" type="button" onClick={unlogEntry} disabled={!entry.status && entry.value === null}>
        Unlog
      </button>
    </article>
  );
}

function StatusSelector({ value, onChange }: { value: GoalStatus | null; onChange: (status: GoalStatus) => void }) {
  return (
    <div className="segmented-control" aria-label="Completion status">
      {(["minimum", "normal", "exceeds"] as GoalStatus[]).map((status) => (
        <button className={value === status ? `active status-${status}` : ""} key={status} onClick={() => onChange(status)}>
          {status}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: GoalStatus | null | undefined }) {
  return <span className={`status-pill ${status ? `status-${status}` : ""}`}>{status ?? "open"}</span>;
}

function HistoryView({
  goals,
  entriesByKey,
  selectedDate,
  onSelectDate,
}: {
  goals: Goal[];
  entriesByKey: Map<string, GoalEntry>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const dates = getRecentDates(21, selectedDate).reverse();

  return (
    <section className="screen">
      <div className="section-heading">
        <h2>History</h2>
        <BarChart3 size={22} />
      </div>
      <div className="history-list">
        {dates.map((date) => {
          const dailyGoals = goals.filter((goal) => goal.cadence === "daily");
          const completed = dailyGoals.filter((goal) => isGoalEntryComplete(entriesByKey.get(getGoalEntryKey(goal.id, date))));
          return (
            <button className="history-row" key={date} onClick={() => onSelectDate(date)}>
              <div>
                <strong>{formatFriendlyDate(date)}</strong>
                <small>{completed.length} of {dailyGoals.length} daily goals</small>
              </div>
              <div className="history-statuses">
                {dailyGoals.slice(0, 4).map((goal) => {
                  const entry = entriesByKey.get(getGoalEntryKey(goal.id, date));
                  return <span className={entry?.status ? `status-dot status-${entry.status}` : "status-dot"} key={goal.id} title={goal.title} />;
                })}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StreaksView({ streaks, goals, entries }: { streaks: Streak[]; goals: Goal[]; entries: GoalEntry[] }) {
  const metricGoals = goals.filter((goal) => goal.type === "numeric" || goal.type === "trend");

  return (
    <section className="screen">
      <div className="section-heading">
        <h2>Streaks</h2>
        <Flame size={22} />
      </div>
      <div className="streak-grid">
        {streaks.map((streak) => (
          <article className={`streak-card ${streak.accent}`} key={streak.label}>
            <small>{streak.label}</small>
            <strong>{streak.current}</strong>
            <span>best {streak.longest} {streak.unit}</span>
          </article>
        ))}
      </div>

      {metricGoals.map((goal) => (
        <GoalChart key={goal.id} goal={goal} entries={entries} />
      ))}
    </section>
  );
}

function GoalChart({ goal, entries }: { goal: Goal; entries: GoalEntry[] }) {
  const periods = goal.cadence === "weekly" ? getRecentWeekStarts(8) : getRecentDates(14);
  const chartData = periods.map((period) => {
    const entry = entries.find((item) => item.goalId === goal.id && item.periodDate === period);
    return {
      period: period.slice(5),
      value: entry?.value ?? null,
      status: entry?.status ?? null,
    };
  });

  return (
    <ChartPanel title={goal.title}>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
          <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#10231d" strokeWidth={3} dot={<ChartStatusDot />} />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

function SettingsView({
  storageMode,
  goals,
  onSaveGoal,
  onRemoveGoal,
}: {
  storageMode: string;
  goals: Goal[];
  onSaveGoal: (goal: Goal) => Promise<void> | void;
  onRemoveGoal: (goalId: string) => Promise<void> | void;
}) {
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [removeGoal, setRemoveGoal] = useState<Goal | null>(null);

  function createGoal() {
    const order = goals.length ? Math.max(...goals.map((goal) => goal.displayOrder)) + 10 : 10;
    setEditingGoal({
      ...createDefaultGoals()[0],
      id: createGoalId(),
      title: "New goal",
      description: "",
      type: "status",
      cadence: "daily",
      unit: "",
      targetDirection: "none",
      minimumThreshold: null,
      normalThreshold: null,
      exceedsThreshold: null,
      displayOrder: order,
    });
  }

  async function saveGoal(goal: Goal) {
    await onSaveGoal(goal);
    setEditingGoal(null);
  }

  async function confirmRemoveGoal() {
    if (!removeGoal) return;
    await onRemoveGoal(removeGoal.id);
    setRemoveGoal(null);
  }

  return (
    <section className="screen">
      <div className="section-heading">
        <h2>Settings</h2>
        <User size={22} />
      </div>

      <div className="settings-list">
        <div>
          <span>Sign in</span>
          <strong>Email and password</strong>
        </div>
        <div>
          <span>Storage</span>
          <strong>{storageMode}</strong>
        </div>
      </div>

      <div className="section-heading">
        <h2>Goals</h2>
        <button className="icon-button" aria-label="Add goal" onClick={createGoal}>
          <Plus size={20} />
        </button>
      </div>

      <div className="goal-settings-list">
        {goals.map((goal) => (
          <article className="goal-settings-card" key={goal.id}>
            <div>
              <h3>{goal.title}</h3>
              <p>{goal.description || "No description"}</p>
              <small>{goal.type} - {goal.cadence}{goal.archivedAt ? " - archived" : ""}</small>
            </div>
            <div className="settings-actions">
              <button onClick={() => setEditingGoal(goal)}>Edit</button>
              <button onClick={() => onSaveGoal({ ...goal, active: !goal.active, archivedAt: goal.active ? new Date().toISOString() : null })}>
                {goal.active ? "Archive" : "Restore"}
              </button>
              <button className="danger-action" aria-label={`Remove ${goal.title}`} onClick={() => setRemoveGoal(goal)}>
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {editingGoal && <GoalEditor goal={editingGoal} onCancel={() => setEditingGoal(null)} onSave={saveGoal} />}
      {removeGoal && (
        <ConfirmRemoveGoal goal={removeGoal} onCancel={() => setRemoveGoal(null)} onConfirm={confirmRemoveGoal} />
      )}
    </section>
  );
}

function GoalEditor({
  goal,
  onCancel,
  onSave,
}: {
  goal: Goal;
  onCancel: () => void;
  onSave: (goal: Goal) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(goal);
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof Goal>(key: K, value: Goal[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "type" && value !== "numeric") {
        next.targetDirection = "none";
        next.minimumThreshold = null;
        next.normalThreshold = null;
        next.exceedsThreshold = null;
      }
      if (key === "type" && value === "numeric") {
        next.targetDirection = "atLeast";
      }
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    await onSave(draft);
    setIsSaving(false);
  }

  return (
    <div className="modal-backdrop">
      <article className="modal-panel">
        <h2>{goal.id.startsWith("goal-new") ? "Add goal" : "Edit goal"}</h2>
        <label>
          <span>Title</span>
          <input value={draft.title} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <input value={draft.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        <div className="field-grid">
          <SelectField label="Type" value={draft.type} options={["status", "numeric", "trend"]} onChange={(value) => update("type", value as GoalType)} />
          <SelectField label="Cadence" value={draft.cadence} options={["daily", "weekly"]} onChange={(value) => update("cadence", value as GoalCadence)} />
        </div>
        <label>
          <span>Unit</span>
          <input value={draft.unit} onChange={(event) => update("unit", event.target.value)} placeholder="miles, calories, lbs" />
        </label>

        {draft.type === "numeric" && (
          <>
            <SelectField
              label="Target direction"
              value={draft.targetDirection}
              options={["atLeast", "atMost"]}
              onChange={(value) => update("targetDirection", value as GoalTargetDirection)}
            />
            <div className="field-grid three">
              <NumberField label="Minimum" value={draft.minimumThreshold} onChange={(value) => update("minimumThreshold", value)} />
              <NumberField label="Normal" value={draft.normalThreshold} onChange={(value) => update("normalThreshold", value)} />
              <NumberField label="Exceeds" value={draft.exceedsThreshold} onChange={(value) => update("exceedsThreshold", value)} />
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary-action compact-action" onClick={handleSave} disabled={isSaving || !draft.title.trim()}>
            Save goal
          </button>
        </div>
      </article>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function ConfirmRemoveGoal({
  goal,
  onCancel,
  onConfirm,
}: {
  goal: Goal;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  return (
    <div className="modal-backdrop">
      <article className="modal-panel">
        <h2>Remove this goal?</h2>
        <p>This will permanently remove {goal.title} and its tracked history. This cannot be undone.</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger-fill" onClick={onConfirm}>Remove permanently</button>
        </div>
      </article>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="chart-panel">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function ChartStatusDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { status?: GoalStatus | null } }) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  const fill = getStatusColor(payload?.status ?? null);
  return <circle cx={cx} cy={cy} r={4.5} fill={fill} stroke="#fffdf9" strokeWidth={2} />;
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getGoalSummary(goals: Goal[], entriesByKey: Map<string, GoalEntry>, selectedDate: string, streaks: Streak[]) {
  const completed = goals.filter((goal) => {
    const periodDate = getGoalPeriodDate(goal, selectedDate);
    return isGoalEntryComplete(entriesByKey.get(getGoalEntryKey(goal.id, periodDate)));
  });

  return {
    completed: completed.length,
    total: goals.length,
    bestStreak: Math.max(0, ...streaks.map((streak) => streak.current)),
  };
}

function getStatusColor(status: GoalStatus | null): string {
  if (status === "minimum") return "#f4c95d";
  if (status === "normal") return "#3d7f6b";
  if (status === "exceeds") return "#79a76b";
  if (status === "logged") return "#9ba69f";
  return "#d8ccbc";
}

function isEmptyGoalEntry(entry: GoalEntry): boolean {
  return entry.value === null && entry.status === null;
}

function createGoalId(): string {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return `goal-new-${window.crypto.randomUUID()}`;
  }

  return `goal-new-${Date.now()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default App;
