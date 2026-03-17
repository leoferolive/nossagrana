const COLORS = ['#22C55E', '#3B82F6', '#EF4444', '#F59E0B', '#A78BFA', '#FB923C', '#60A5FA'];

interface PieChartItem {
  label: string;
  value: number;
}

interface PieChartProps {
  data: PieChartItem[];
  size?: number;
}

const polarToXY = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const describeArc = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) => {
  const s = polarToXY(cx, cy, outerR, startAngle);
  const e = polarToXY(cx, cy, outerR, endAngle);
  const si = polarToXY(cx, cy, innerR, endAngle);
  const ei = polarToXY(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${s.x} ${s.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${si.x} ${si.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
};

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PieChart = ({ data, size = 120 }: PieChartProps) => {
  if (!data.length) return null;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.26;

  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const slice = (d.value / total) * 2 * Math.PI;
    const path = describeArc(cx, cy, outerR, innerR, angle, angle + slice);
    angle += slice;
    return {
      ...d,
      path,
      color: COLORS[i % COLORS.length],
      pct: ((d.value / total) * 100).toFixed(0),
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        aria-hidden="true"
      >
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} />
        ))}
      </svg>
      <ul className="flex flex-col gap-1.5">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-text-muted">{s.label}</span>
            <span className="ml-auto font-semibold text-text tabular-nums">
              {formatBRL(s.value)}
            </span>
            <span className="text-text-dim">({s.pct}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
