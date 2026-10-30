export const PANEL_IDS = ["campaign", "participants", "properties", "history"] as const;
export type PanelId = typeof PANEL_IDS[number];
export type DockSide = "left" | "right" | "bottom";
export type DockState = { left: PanelId[]; right: PanelId[]; bottom: PanelId[]; hidden: PanelId[]; leftWidth: number; rightWidth: number };
export function defaultDockState(): DockState {
  return { left: ["campaign", "participants"], right: ["properties"], bottom: ["history"], hidden: [], leftWidth: 240, rightWidth: 240 };
}
export function readDockState(value: unknown): DockState {
  if (!value || typeof value !== "object") return defaultDockState();
  const data = value as Record<string, unknown>;
  const state = defaultDockState();
  const used = new Set<PanelId>();
  for (const side of ["left", "right", "bottom", "hidden"] as const) {
    if (!Array.isArray(data[side])) return defaultDockState();
    state[side] = [];
    for (const id of data[side]) {
      if (!PANEL_IDS.includes(id as PanelId) || used.has(id as PanelId)) return defaultDockState();
      used.add(id as PanelId); state[side].push(id as PanelId);
    }
  }
  if (used.size !== PANEL_IDS.length) return defaultDockState();
  for (const key of ["leftWidth", "rightWidth"] as const) {
    const width = data[key];
    if (typeof width === "number" && Number.isFinite(width)) state[key] = Math.max(180, Math.min(400, width));
  }
  return state;
}
export function movePanel(state: DockState, id: PanelId, side: DockSide | "hidden", before?: PanelId): DockState {
  const next = structuredClone(state);
  for (const key of ["left", "right", "bottom", "hidden"] as const) next[key] = next[key].filter((item) => item !== id);
  const index = before ? next[side].indexOf(before) : -1;
  next[side].splice(index < 0 ? next[side].length : index, 0, id);
  return next;
}
