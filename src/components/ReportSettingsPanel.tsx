import { Eye, Mail, RotateCw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Goal, GoalEntry, ReportSettings } from "../types";
import { buildWeeklyReport } from "../lib/weeklyReport";

export function ReportSettingsPanel({ goals, entries, useCloudData, deliveryConfigured, localSettings, onSaveLocal }: {
  goals: Goal[];
  entries: GoalEntry[];
  useCloudData: boolean;
  deliveryConfigured?: boolean;
  localSettings?: ReportSettings | null;
  onSaveLocal: (settings: ReportSettings) => void;
}) {
  const activeGoals = goals.filter((goal) => goal.active && !goal.archivedAt);
  const [draft, setDraft] = useState<ReportSettings>(() => localSettings ?? {
    enabled: false, recipientEmail: "", goalIds: activeGoals.map((goal) => goal.id),
  });
  const [loading, setLoading] = useState(useCloudData);
  const [loaded, setLoaded] = useState(!useCloudData);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const report = buildWeeklyReport(goals, entries, draft.goalIds);

  useEffect(() => {
    if (!useCloudData) return;
    let active = true;
    setLoading(true);
    setError("");
    void import("../lib/cloudData").then(({ loadReportSettings }) => loadReportSettings())
      .then((settings) => { if (active) { if (settings) setDraft(settings); setLoaded(true); } })
      .catch(() => { if (active) setError("Unable to load email settings. Try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [useCloudData, attempt]);

  function update(change: Partial<ReportSettings>) {
    setDraft((current) => ({ ...current, ...change }));
    setSaved(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (draft.enabled && report.goalCount === 0) throw new Error("Select at least one habit.");
      const settings = { ...draft, recipientEmail: draft.recipientEmail.trim() };
      if (useCloudData) {
        const { saveReportSettings } = await import("../lib/cloudData");
        setDraft(await saveReportSettings(settings));
      } else {
        onSaveLocal(settings);
      }
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save email settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="report-settings">
      <div className="section-heading compact"><h2>Weekly email report</h2><Mail size={21} /></div>
      <p className="report-schedule">Mondays, 8:00 AM · America/Denver</p>
      {useCloudData && !deliveryConfigured && <p className="report-schedule">Email delivery setup is pending. Your report preferences can be saved now.</p>}
      {loading && <p role="status">Loading email settings...</p>}
      {error && <p className="report-error" role="alert">{error}</p>}
      {!loaded && !loading && <button className="icon-button" title="Retry email settings" aria-label="Retry email settings" onClick={() => setAttempt((current) => current + 1)}><RotateCw size={20} /></button>}
      {loaded && <form onSubmit={save}>
        <fieldset disabled={saving} className="report-fields">
          <label className="report-toggle"><input type="checkbox" checked={draft.enabled} onChange={(event) => update({ enabled: event.target.checked })} /><span>Send weekly reports</span></label>
          <label className="report-email"><span>Recipient email</span><input type="email" required autoComplete="email" value={draft.recipientEmail} onChange={(event) => update({ recipientEmail: event.target.value })} placeholder="you@example.com" /></label>
          <fieldset className="report-habits">
            <legend>Habits to include</legend>
            {activeGoals.map((goal) => <label className="widget-goal-option" key={goal.id}><input type="checkbox" checked={draft.goalIds.includes(goal.id)} onChange={(event) => update({ goalIds: event.target.checked ? [...draft.goalIds, goal.id] : draft.goalIds.filter((id) => id !== goal.id) })} /><span>{goal.title}</span></label>)}
            {activeGoals.length === 0 && <p>No active habits.</p>}
          </fieldset>
          <div className="report-actions">
            <button type="button" className="report-preview-button" onClick={() => setPreview(true)} disabled={!report.goalCount}><Eye size={18} />Preview report</button>
            <button type="submit" className="primary-action compact-action" disabled={draft.enabled && report.goalCount === 0}><Save size={18} />{saving ? "Saving..." : "Save email settings"}</button>
          </div>
        </fieldset>
        {saved && <p role="status" className="good">Email settings saved{useCloudData ? "." : " for this preview."}</p>}
      </form>}
      {preview && <div className="modal-backdrop"><section className="report-preview" role="dialog" aria-modal="true" aria-labelledby="report-preview-title"><div className="section-heading"><h2 id="report-preview-title">Weekly report preview</h2><button className="icon-button" aria-label="Close report preview" onClick={() => setPreview(false)}><X size={20} /></button></div><iframe title="Weekly habit email" sandbox="" srcDoc={report.html} /></section></div>}
    </section>
  );
}
