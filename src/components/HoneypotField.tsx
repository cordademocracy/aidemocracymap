/**
 * Hidden trap input for the public forms. Humans never see or reach it
 * (off-screen, untabbable, hidden from AT); autofilling bots do, and any
 * value marks the submission for a silent server-side drop.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      name="companyUrl"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      aria-hidden="true"
      autoComplete="off"
      style={{ position: "absolute", left: "-9999px" }}
    />
  );
}
