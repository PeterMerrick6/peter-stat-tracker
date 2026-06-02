import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppData, DailyEntry, Streak, WeeklyEntry } from "./types";
import { addDays, formatFriendlyDate, getMondayWeekStart, getRecentDates, getRecentWeekStarts, todayInDenver } from "./lib/date";
import { loadAppData, saveAppData } from "./lib/storage";
import { buildStreaks } from "./lib/streaks";

type Tab = "today" | "history" | "streaks" | "settings";

const CALORIE_LIMIT = 1950;
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

const emptyDaily = (entryDate: string): DailyEntry => ({
  entryDate,
  calories: null,
  flashcardsComplete: false,
  milesRun: null,
});

const emptyWeekly = (weekStartDate: string): WeeklyEntry => ({
  weekStartDate,
  weightLbs: null,
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

  const selectedWeek = getMondayWeekStart(selectedDate);
  const dailyEntry = data.dailyEntries.find((entry) => entry.entryDate === selectedDate) ?? emptyDaily(selectedDate);
  const weeklyEntry = data.weeklyEntries.find((entry) => entry.weekStartDate === selectedWeek) ?? emptyWeekly(selectedWeek);
  const streaks = useMemo(() => buildStreaks(data.dailyEntries, data.weeklyEntries), [data]);

  async function upsertDaily(entry: DailyEntry) {
    const exists = data.dailyEntries.some((item) => item.entryDate === entry.entryDate);

    setData((current) => ({
      ...current,
      dailyEntries: [
        ...current.dailyEntries.filter((item) => item.entryDate !== entry.entryDate),
        entry,
      ].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    }));

    if (useCloudData) {
      const { saveCloudDailyEntry } = await import("./lib/cloudData");
      await saveCloudDailyEntry(entry, exists);
    }
  }

  async function upsertWeekly(entry: WeeklyEntry) {
    const exists = data.weeklyEntries.some((item) => item.weekStartDate === entry.weekStartDate);

    setData((current) => ({
      ...current,
      weeklyEntries: [
        ...current.weeklyEntries.filter((item) => item.weekStartDate !== entry.weekStartDate),
        entry,
      ].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate)),
    }));

    if (useCloudData) {
      const { saveCloudWeeklyEntry } = await import("./lib/cloudData");
      await saveCloudWeeklyEntry(entry, exists);
    }
  }

  const todaySummary = getTodaySummary(dailyEntry);

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
            <span>{todaySummary.calories}</span>
            <small>calories</small>
          </div>
          <div>
            <span>{todaySummary.miles}</span>
            <small>miles</small>
          </div>
          <div>
            <span>{streaks[0]?.current ?? 0}</span>
            <small>day streak</small>
          </div>
        </section>

        {isCloudLoading && <p className="status-banner">Loading cloud data...</p>}
        {syncError && <p className="status-banner error">{syncError}</p>}

        {activeTab === "today" && (
          <TodayView
            selectedDate={selectedDate}
            dailyEntry={dailyEntry}
            weeklyEntry={weeklyEntry}
            onDateChange={setSelectedDate}
            onSaveDaily={upsertDaily}
            onSaveWeekly={upsertWeekly}
          />
        )}

        {activeTab === "history" && (
          <HistoryView
            data={data}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setActiveTab("today");
            }}
          />
        )}

        {activeTab === "streaks" && <StreaksView streaks={streaks} data={data} />}

        {activeTab === "settings" && <SettingsView storageMode={storageMode} />}
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
  dailyEntry,
  weeklyEntry,
  onDateChange,
  onSaveDaily,
  onSaveWeekly,
}: {
  selectedDate: string;
  dailyEntry: DailyEntry;
  weeklyEntry: WeeklyEntry;
  onDateChange: (date: string) => void;
  onSaveDaily: (entry: DailyEntry) => Promise<void> | void;
  onSaveWeekly: (entry: WeeklyEntry) => Promise<void> | void;
}) {
  const [calories, setCalories] = useState(dailyEntry.calories?.toString() ?? "");
  const [flashcardsComplete, setFlashcardsComplete] = useState(dailyEntry.flashcardsComplete);
  const [milesRun, setMilesRun] = useState(dailyEntry.milesRun?.toString() ?? "");
  const [weightLbs, setWeightLbs] = useState(weeklyEntry.weightLbs?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCalories(dailyEntry.calories?.toString() ?? "");
    setFlashcardsComplete(dailyEntry.flashcardsComplete);
    setMilesRun(dailyEntry.milesRun?.toString() ?? "");
    setWeightLbs(weeklyEntry.weightLbs?.toString() ?? "");
    setSaved(false);
    setSaveError(null);
  }, [dailyEntry, weeklyEntry]);

  const parsedCalories = calories === "" ? null : Math.max(0, Math.round(Number(calories)));
  const parsedMiles = milesRun === "" ? null : Math.max(0, Number(milesRun));
  const parsedWeight = weightLbs === "" ? null : Math.max(0, Number(weightLbs));
  const isUnderLimit = typeof parsedCalories === "number" && parsedCalories <= CALORIE_LIMIT;

  async function handleSave() {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSaveDaily({
        entryDate: selectedDate,
        calories: Number.isFinite(parsedCalories) ? parsedCalories : null,
        flashcardsComplete,
        milesRun: Number.isFinite(parsedMiles) ? parsedMiles : null,
      });
      await onSaveWeekly({
        weekStartDate: getMondayWeekStart(selectedDate),
        weightLbs: Number.isFinite(parsedWeight) ? parsedWeight : null,
      });
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

      <div className="field-grid">
        <label className="stat-field">
          <span>Calories</span>
          <input
            inputMode="numeric"
            min="0"
            pattern="[0-9]*"
            type="number"
            value={calories}
            onChange={(event) => setCalories(event.target.value)}
            placeholder="1950"
          />
          <small className={isUnderLimit ? "good" : "muted"}>{calories === "" ? "1,950 limit" : isUnderLimit ? "Under limit" : "Over limit"}</small>
        </label>

        <label className="stat-field">
          <span>Miles</span>
          <input
            inputMode="decimal"
            min="0"
            step="0.01"
            type="number"
            value={milesRun}
            onChange={(event) => setMilesRun(event.target.value)}
            placeholder="0.00"
          />
          <small className="muted">0 is valid</small>
        </label>
      </div>

      <button className={`toggle-card ${flashcardsComplete ? "active" : ""}`} onClick={() => setFlashcardsComplete((value) => !value)}>
        <span>
          <Check size={22} />
        </span>
        <strong>Flash cards complete</strong>
      </button>

      <label className="weekly-field">
        <span>Week of {formatFriendlyDate(getMondayWeekStart(selectedDate))}</span>
        <strong>Weight</strong>
        <div>
          <input
            inputMode="decimal"
            min="0"
            step="0.1"
            type="number"
            value={weightLbs}
            onChange={(event) => setWeightLbs(event.target.value)}
            placeholder="lbs"
          />
          <small>lbs</small>
        </div>
      </label>

      {saveError && <p className="status-banner error">{saveError}</p>}

      <button className="primary-action" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : saved ? "Saved" : "Save entry"}
      </button>
    </section>
  );
}

function HistoryView({ data, selectedDate, onSelectDate }: { data: AppData; selectedDate: string; onSelectDate: (date: string) => void }) {
  const dates = getRecentDates(21, selectedDate).reverse();
  const dailyByDate = new Map(data.dailyEntries.map((entry) => [entry.entryDate, entry]));

  return (
    <section className="screen">
      <div className="section-heading">
        <h2>History</h2>
        <BarChart3 size={22} />
      </div>
      <div className="history-list">
        {dates.map((date) => {
          const entry = dailyByDate.get(date);
          return (
            <button className="history-row" key={date} onClick={() => onSelectDate(date)}>
              <div>
                <strong>{formatFriendlyDate(date)}</strong>
                <small>{entry?.flashcardsComplete ? "Flash cards done" : "Flash cards open"}</small>
              </div>
              <div className="history-metrics">
                <span>{entry?.calories ?? "-"}</span>
                <span>{entry?.milesRun ?? "-"} mi</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StreaksView({ streaks, data }: { streaks: Streak[]; data: AppData }) {
  const chartData = getRecentDates(14).map((date) => {
    const entry = data.dailyEntries.find((item) => item.entryDate === date);
    return {
      date: date.slice(5),
      calories: entry?.calories ?? null,
      miles: entry?.milesRun ?? null,
    };
  });

  const weightData = getRecentWeekStarts(8).map((week) => {
    const entry = data.weeklyEntries.find((item) => item.weekStartDate === week);
    return {
      week: week.slice(5),
      weight: entry?.weightLbs ?? null,
    };
  });

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

      <ChartPanel title="Calories">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="calories" stroke="#b98500" fill="#f4c95d" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Miles">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="miles" stroke="#c85235" fill="#e86f51" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel title="Weight">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={weightData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8dfd2" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke="#10231d" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>
    </section>
  );
}

function SettingsView({ storageMode }: { storageMode: string }) {
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
          <span>Timezone</span>
          <strong>America/Denver</strong>
        </div>
        <div>
          <span>Calories</span>
          <strong>1,950 daily limit</strong>
        </div>
        <div>
          <span>Weight</span>
          <strong>Monday, lbs</strong>
        </div>
        <div>
          <span>Storage</span>
          <strong>{storageMode}</strong>
        </div>
      </div>
    </section>
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

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function getTodaySummary(entry: DailyEntry) {
  return {
    calories: entry.calories ?? "-",
    miles: entry.milesRun ?? "-",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export default App;
