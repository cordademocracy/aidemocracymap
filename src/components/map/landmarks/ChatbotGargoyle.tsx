import { memo } from "react";
import { BRONZE, INK_LINE, SNOW, STONE_D, type LandmarkProps } from "./palette";

/** Governance Grove: a stone owl automaton on the banner pole, mid-sentence
 * since the map was drawn. Anchor is the pole's finial — the bird sits on it. */
export const ChatbotGargoyle = memo(function ChatbotGargoyle({ x, y, s = 1 }: LandmarkProps) {
  const u = (n: number) => n * s;
  const px = (n: number) => x + n * s;
  const py = (n: number) => y + n * s;
  const poly = (pts: [number, number][]) => pts.map(([a, b]) => `${px(a)},${py(b)}`).join(" ");

  return (
    <g>
      {[-1.05, 0.45].map((fx) => (
        <rect key={fx} x={px(fx)} y={py(-0.5)} width={u(0.6)} height={u(0.6)} fill={BRONZE} />
      ))}

      <ellipse cx={px(0)} cy={py(-2.9)} rx={u(2.3)} ry={u(2.7)} fill={STONE_D} />
      <path
        d={`M ${px(-2.2)} ${py(-4)} Q ${px(-2.9)} ${py(-2.4)} ${px(-1.5)} ${py(-0.9)}
            Q ${px(-1.9)} ${py(-2.6)} ${px(-2.2)} ${py(-4)} Z`}
        fill={INK_LINE}
        opacity={0.28}
      />
      <circle cx={px(0)} cy={py(-3.1)} r={u(0.42)} fill={BRONZE} />

      <circle cx={px(0)} cy={py(-6)} r={u(1.75)} fill={STONE_D} />
      {[-1.5, 1.5].map((tx) => (
        <polygon
          key={tx}
          points={poly([[tx * 0.62, -7.1], [tx, -8.3], [tx * 1.05, -6.7]])}
          fill={STONE_D}
        />
      ))}
      <path d={`M ${px(-1.7)} ${py(-6.4)} L ${px(1.7)} ${py(-6.4)}`} stroke={INK_LINE} strokeWidth={u(0.2)} opacity={0.5} />
      {[-0.7, 0.7].map((ex) => (
        <g key={ex}>
          <circle cx={px(ex)} cy={py(-6.05)} r={u(0.62)} fill={SNOW} />
          <circle cx={px(ex)} cy={py(-6.05)} r={u(0.3)} fill={INK_LINE} />
        </g>
      ))}
      <polygon points={poly([[-0.45, -5.5], [0.45, -5.5], [0, -4.7]])} fill={BRONZE} />

      {/* still typing */}
      <polygon points={poly([[-4.4, -8.2], [-2.6, -6.7], [-4.4, -6.3]])} fill={SNOW} stroke={INK_LINE} strokeWidth={u(0.5)} strokeLinejoin="round" />
      <rect
        x={px(-12.6)}
        y={py(-11.6)}
        width={u(8.4)}
        height={u(5.8)}
        rx={u(0.9)}
        fill={SNOW}
        stroke={INK_LINE}
        strokeWidth={u(0.5)}
      />
      {[-10.4, -8.4, -6.4].map((dx) => (
        <circle key={dx} cx={px(dx)} cy={py(-8.7)} r={u(0.62)} fill={INK_LINE} />
      ))}
    </g>
  );
});
