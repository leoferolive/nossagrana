interface MiniChartProps {
  data: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  labels?: string[];
}

export const MiniChart = ({
  data,
  height = 60,
  color = '#22C55E',
  fill = true,
  labels,
}: MiniChartProps) => {
  if (data.length < 2) return null;

  const width = 300;
  const padX = 4;
  const padY = 4;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const xs = data.map((_, i) => padX + (i / (data.length - 1)) * chartW);
  const ys = data.map((v) => padY + chartH - ((v - min) / range) * chartH);

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const polygon = [
    `${xs[0]},${padY + chartH}`,
    ...xs.map((x, i) => `${x},${ys[i]}`),
    `${xs[xs.length - 1]},${padY + chartH}`,
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {fill && <polygon points={polygon} fill={color} fillOpacity={0.12} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={3} fill={color} />
      ))}
      {labels && (
        <g>
          {labels.map((label, i) => (
            <text key={i} x={xs[i]} y={height} textAnchor="middle" fontSize={9} fill="#8B8D9A">
              {label}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
};
