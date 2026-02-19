import { useMemo, useState } from "react";
import type { GratitudeEntry, GratitudeFrequency, GratitudeSettings } from "../lib/gratitude";

type Props = {
  settings: GratitudeSettings;
  entries: GratitudeEntry[];
  onChangeEnabled: (enabled: boolean) => void;
  onChangeFrequency: (frequency: GratitudeFrequency) => void;
  onOpenEntry: (entry: GratitudeEntry) => void;
  onDeleteEntry: (entry: GratitudeEntry) => void;
  onCopyAll: () => void;
  onExportTxt: () => void;
};

function previewLine(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 84);
}

export function GratitudeHubPanel({
  settings,
  entries,
  onChangeEnabled,
  onChangeFrequency,
  onOpenEntry,
  onDeleteEntry,
  onCopyAll,
  onExportTxt
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleEntries = useMemo(() => (showAll ? entries : entries.slice(0, 8)), [entries, showAll]);

  return (
    <section className="admin-v1-card mt-3 rounded-2xl border border-slate-300/20 bg-slate-900/70 p-3 gratitude-hub">
      <div className="gratitude-hub__head">
        <h2 className="text-base font-semibold text-slate-100">Gratitude Hub</h2>
        <span className="gratitude-hub__spark" aria-hidden="true" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-300">
          Enabled
          <select
            value={settings.enabled ? "enabled" : "disabled"}
            onChange={(event) => onChangeEnabled(event.currentTarget.value === "enabled")}
            className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-slate-300">
          Frequency
          <select
            value={settings.frequency}
            onChange={(event) => onChangeFrequency(event.currentTarget.value as GratitudeFrequency)}
            className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-3 py-2 text-slate-100"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="launch">Every App Launch</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>

      <div className="gratitude-hub__tools">
        <button type="button" className="admin-primary rounded-xl px-3 py-2 text-sm text-white" onClick={onCopyAll}>
          Copy All
        </button>
        <button type="button" className="admin-primary rounded-xl px-3 py-2 text-sm text-white" onClick={onExportTxt}>
          Export .txt
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-300"
          disabled
          title="PDF export coming soon"
        >
          Export PDF (Soon)
        </button>
      </div>

      <div className="gratitude-hub__list-wrap">
        <div className="gratitude-hub__list-title">Entries ({entries.length})</div>
        {visibleEntries.length ? (
          <ul className="gratitude-hub__list">
            {visibleEntries.map((entry) => (
              <li key={entry.createdAt} className="gratitude-hub__item">
                <button type="button" className="gratitude-hub__entry-hit" onClick={() => onOpenEntry(entry)}>
                  <span className="gratitude-hub__entry-date">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <span className="gratitude-hub__entry-preview">{previewLine(entry.text)}</span>
                </button>
                <button
                  type="button"
                  className="gratitude-hub__delete"
                  onClick={() => onDeleteEntry(entry)}
                  aria-label="Delete gratitude entry"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="gratitude-hub__empty">No entries yet. Your saved reflections appear here.</p>
        )}
      </div>

      {!showAll && entries.length > 8 && (
        <button
          type="button"
          className="rounded-xl border border-slate-300/20 bg-slate-800/70 px-3 py-2 text-sm text-slate-200"
          onClick={() => setShowAll(true)}
        >
          View All
        </button>
      )}
    </section>
  );
}
