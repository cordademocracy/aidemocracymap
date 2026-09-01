import { useId, useState } from "react";
import type { KeyProject } from "../../data/types";
import { m } from "../../paraglide/messages.js";

export function KeyProjectsField({
  value,
  onChange,
  max,
}: {
  value: KeyProject[];
  onChange: (next: KeyProject[]) => void;
  max: number;
}) {
  // local rows may include a not-yet-named row; onChange only ever sees named ones
  const [rows, setRows] = useState<KeyProject[]>(value);
  const baseId = useId();
  const labelId = `${baseId}-label`;

  function commit(next: KeyProject[]) {
    setRows(next);
    onChange(next.filter((p) => p.name.trim() !== ""));
  }

  function setRow(i: number, patch: Partial<KeyProject>) {
    commit(rows.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  function addRow() {
    if (rows.length >= max) return;
    commit([...rows, { name: "" }]);
  }

  function removeRow(i: number) {
    commit(rows.filter((_, j) => j !== i));
  }

  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className="eyebrow">
        {m["forms.keyProjects.label"]()}
      </span>
      <div className="space-y-2 mt-1.5">
        {rows.map((p, i) => {
          const nameId = `${baseId}-name-${i}`;
          const urlId = `${baseId}-url-${i}`;
          const noteId = `${baseId}-note-${i}`;
          const rowName = p.name.trim() || m["forms.keyProjects.untitled"]({ n: i + 1 });
          return (
            <div key={i} className="flex gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor={nameId} className="sr-only">
                  {m["forms.keyProjects.name"]()}
                </label>
                <input
                  id={nameId}
                  value={p.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  placeholder={m["forms.keyProjects.name"]()}
                  className="corda-input w-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor={urlId} className="sr-only">
                  {m["forms.keyProjects.url"]()}
                </label>
                <input
                  id={urlId}
                  type="url"
                  value={p.url ?? ""}
                  onChange={(e) => setRow(i, { url: e.target.value })}
                  placeholder={m["forms.keyProjects.url"]()}
                  className="corda-input w-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor={noteId} className="sr-only">
                  {m["forms.keyProjects.note"]()}
                </label>
                <input
                  id={noteId}
                  value={p.note ?? ""}
                  onChange={(e) => setRow(i, { note: e.target.value })}
                  placeholder={m["forms.keyProjects.note"]()}
                  className="corda-input w-full"
                />
              </div>
              <button
                type="button"
                aria-label={m["forms.keyProjects.removeRow"]({ name: rowName })}
                onClick={() => removeRow(i)}
                className="corda-icon-btn shrink-0"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={addRow}
        className="btn-corda mt-2"
        style={rows.length >= max ? { opacity: 0.5 } : undefined}
      >
        {m["forms.keyProjects.addRow"]()}
      </button>
    </div>
  );
}
