export const IGS = {
  bg:        "#f7f6f2",
  surface:   "#ffffff",
  ink:       "#161513",
  ink2:      "#4a463f",
  muted:     "#8c897f",
  line:      "#ece9e1",
  line2:     "#d9d5c9",
  accent:    "#c24e2f",
  accentInk: "#ffffff",
  ok:        "#6a9e7f",
  warn:      "#d9b441",
  danger:    "#c24e2f",
} as const;

export const STATIONS = {
  parrilla: { label: "Parrilla", color: "#c24e2f" },
  caliente: { label: "Cocina caliente", color: "#d9b441" },
  fria:     { label: "Fría · Bar", color: "#6a9e7f" },
  postres:  { label: "Postres", color: "#8a6bb0" },
} as const;

export type StationId = keyof typeof STATIONS;

export const formatARS = (n: number) =>
  "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
