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
  const padTop = 4;
  const labelHeight = labels ? 14 : 0;
  const padBottom = 4 + labelHeight;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const max = Math.max(...data);
  const range = max || 1;

  const xs = data.map((_, i) => padX + (i / (data.length - 1)) * chartW);
  const ys = data.map((v) => padTop + chartH - (v / range) * chartH);

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const polygon = [
    `${xs[0]},${padTop + chartH}`,
    ...xs.map((x, i) => `${x},${ys[i]}`),
    `${xs[xs.length - 1]},${padTop + chartH}`,
  ].join(' ');

  const showCircles = data.length <= 15;

  const visibleLabels = labels
    ? labels.map((label, i) => {
        if (data.length <= 12) return label;
        const day = i + 1;
        if (day === 1 || day % 5 === 0 || day === data.length) return label;
        return null;
      })
    : null;

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
      {showCircles && xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={3} fill={color} />)}
      {visibleLabels && (
        <g>
          {visibleLabels.map(
            (label, i) =>
              label && (
                <text
                  key={i}
                  x={xs[i]}
                  y={height - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#8B8D9A"
                >
                  {label}
                </text>
              ),
          )}
        </g>
      )}
    </svg>
  );
};
