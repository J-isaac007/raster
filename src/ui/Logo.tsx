import logo from '../brand/logo.json';

const colors: Record<string, string> = logo.colors;

/** One rect per same-colored run in each row of the mark. */
const RUNS = logo.pixels.flatMap((row, y) => {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  for (let x = 0; x < row.length;) {
    let end = x + 1;
    while (end < row.length && row[end] === row[x]) end++;
    const fill = colors[row[x]];
    if (fill) out.push({ x, y, w: end - x, fill });
    x = end;
  }
  return out;
});

/** The Raster mark. Source of truth: src/brand/logo.json. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${logo.size} ${logo.size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect width={logo.size} height={logo.size} rx={logo.radius} fill={logo.background} />
      {RUNS.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
