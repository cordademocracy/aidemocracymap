import { useEffect, useState } from "react";
import { m } from "../paraglide/messages.js";
import { IMAGE_ACCEPT } from "../lib/forms";

/**
 * Corda-styled logo file picker with a 64px preview. The chosen File is owned
 * by the parent; this component only renders it and manages the object-URL
 * lifecycle. When no file is chosen it shows `fallbackSrc` (e.g. the current
 * logo) if provided, otherwise a placeholder.
 */
export function LogoPicker({
  file,
  onFile,
  fallbackSrc,
  inputId,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  fallbackSrc?: string;
  inputId?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? fallbackSrc ?? null;

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-16 h-16 shrink-0 grid place-items-center bg-white overflow-hidden"
        style={{ border: "1px dashed var(--dash)" }}
      >
        {shown ? (
          <img src={shown} alt="" className="w-full h-full object-contain p-1" />
        ) : (
          <span className="eyebrow" style={{ color: "var(--ink-40)" }}>
            {m["common.imagePlaceholder"]()}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <label className="btn-corda btn-corda-sm cursor-pointer">
          {file ? m["forms.logoPicker.change"]() : m["forms.logoPicker.choose"]()}
          <input
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <button
            type="button"
            onClick={() => onFile(null)}
            className="eyebrow hover:opacity-70 transition-opacity"
            style={{ color: "var(--ink-50)" }}
          >
            {m["forms.logoPicker.remove"]()}
          </button>
        )}
      </div>
    </div>
  );
}
