export const HEATMAP_STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0, rgb: [2, 122, 72] },
  { at: 1, rgb: [106, 196, 107] },
  { at: 2, rgb: [232, 213, 148] },
  { at: 4, rgb: [232, 140, 78] },
  { at: 8, rgb: [153, 32, 48] },
];

export const HEATMAP_MAX = 8;

export const HEATMAP_TICKS: { value: number; label: string }[] = [
  { value: 0, label: "Best" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 8, label: "Worse" },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgbString(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function clampBehind(behind: number) {
  if (!Number.isFinite(behind) || behind < 0) return 0;
  return Math.min(behind, HEATMAP_MAX);
}

function stopIndexFor(behind: number) {
  const last = HEATMAP_STOPS.length - 2;
  let i = 0;
  while (i < last && behind > HEATMAP_STOPS[i + 1].at) {
    i += 1;
  }
  return i;
}

export function colorForBehind(behind: number) {
  const x = clampBehind(behind);
  const i = stopIndexFor(x);
  const start = HEATMAP_STOPS[i];
  const end = HEATMAP_STOPS[i + 1];
  const t = (x - start.at) / (end.at - start.at || 1);
  const r = lerp(start.rgb[0], end.rgb[0], t);
  const g = lerp(start.rgb[1], end.rgb[1], t);
  const b = lerp(start.rgb[2], end.rgb[2], t);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return {
    background: rgbString(r, g, b),
    color: luminance > 0.55 ? "#14532d" : "#ffffff",
  };
}

export function heatmapGradient() {
  const parts = HEATMAP_STOPS.map((stop) => {
    const [r, g, b] = stop.rgb;
    const pct = (stop.at / HEATMAP_MAX) * 100;
    return `${rgbString(r, g, b)} ${pct}%`;
  });
  return `linear-gradient(to bottom, ${parts.join(", ")})`;
}
