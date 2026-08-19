export const HEATMAP_STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0, rgb: [74, 222, 128] },
  { at: 0.5, rgb: [163, 230, 53] },
  { at: 1, rgb: [250, 204, 21] },
  { at: 2, rgb: [251, 146, 60] },
  { at: 4, rgb: [244, 114, 182] },
  { at: 6, rgb: [168, 85, 247] },
  { at: 8, rgb: [76, 29, 149] },
];

export const HEATMAP_MAX = 8;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgbString(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

export function colorForBehind(behind: number) {
  const x = Math.min(Math.max(behind, 0), HEATMAP_MAX);
  let i = 0;
  while (i < HEATMAP_STOPS.length - 2 && x > HEATMAP_STOPS[i + 1].at) {
    i += 1;
  }
  const start = HEATMAP_STOPS[i];
  const end = HEATMAP_STOPS[i + 1];
  const t = (x - start.at) / (end.at - start.at || 1);
  const r = lerp(start.rgb[0], end.rgb[0], t);
  const g = lerp(start.rgb[1], end.rgb[1], t);
  const b = lerp(start.rgb[2], end.rgb[2], t);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return {
    background: rgbString(r, g, b),
    color: luminance > 0.55 ? "#171717" : "#ffffff",
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
