import { Menu, Notice } from "obsidian";
import { iconButton } from "./icon-button";
import { defaultDockState, movePanel, readDockState } from "./dock-state";
import type { DockSide, DockState, PanelId } from "./dock-state";

type Panel = { element: HTMLElement; body: HTMLElement; actions: HTMLElement; label: string };
export class DockLayout {
  private state: DockState;
  private readonly panels = new Map<PanelId, Panel>();
  private readonly zones: Record<DockSide, HTMLElement>;
  private dragging: PanelId | undefined;
  private readonly leftHandle: HTMLElement;
  private readonly rightHandle: HTMLElement;

  constructor(private readonly root: HTMLElement, center: HTMLElement, initial: unknown, private readonly changed: (state: DockState) => void) {
    this.state = readDockState(initial);
    root.addClass("vtt-dock");
    this.zones = {
      left: root.createDiv({ cls: "vtt-dock-zone vtt-dock-left", attr: { "aria-label": "Encaixar à esquerda" } }),
      right: root.createDiv({ cls: "vtt-dock-zone vtt-dock-right", attr: { "aria-label": "Encaixar à direita" } }),
      bottom: root.createDiv({ cls: "vtt-dock-zone vtt-dock-bottom", attr: { "aria-label": "Encaixar abaixo" } }),
    };
    center.addClass("vtt-dock-center"); root.append(center);
    this.leftHandle = this.resizer("left"); this.rightHandle = this.resizer("right");
    for (const side of ["left", "right", "bottom"] as const) {
      const zone = this.zones[side];
      zone.dataset.dropLabel = side === "left" ? "Esquerda" : side === "right" ? "Direita" : "Abaixo";
      zone.addEventListener("dragover", (event) => { if (this.dragging) { event.preventDefault(); event.dataTransfer!.dropEffect = "move"; zone.addClass("is-drop-target"); } });
      zone.addEventListener("dragleave", (event) => { if (!zone.contains(event.relatedTarget as Node | null)) zone.removeClass("is-drop-target"); });
      zone.addEventListener("drop", (event) => {
        if (!this.dragging) return;
        event.preventDefault();
        this.place(this.dragging, side);
        this.finishDrag();
      });
    }
  }
  add(id: PanelId, label: string, help: string): Panel {
    const element = this.root.createEl("section", { cls: `vtt-dock-panel vtt-panel-${id}`, attr: { "aria-label": label } });
    const header = element.createEl("header", { cls: "vtt-dock-panel-header", attr: { draggable: "true" } });
    header.createEl("h3", { text: label });
    const actions = header.createDiv({ cls: "vtt-dock-panel-actions" });
    iconButton(actions, "circle-help", `Ajuda: ${label}`, () => { new Notice(help, 10000); });
    const menuButton = iconButton(actions, "ellipsis", `Mover ${label}`, () => {
      const menu = new Menu();
      for (const [side, name] of [["left", "Esquerda"], ["right", "Direita"], ["bottom", "Abaixo"]] as const) {
        menu.addItem((item) => item.setTitle(name).onClick(() => this.place(id, side)));
      }
      const rect = menuButton.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
    });
    iconButton(actions, "panel-top-close", `Ocultar ${label}`, () => this.place(id, "hidden"));
    header.addEventListener("dragstart", (event) => {
      if ((event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
      this.dragging = id;
      event.dataTransfer!.setData("text/plain", id); event.dataTransfer!.effectAllowed = "move";
      this.root.addClass("is-dragging");
    });
    header.addEventListener("dragend", () => this.finishDrag());
    header.addEventListener("dragover", (event) => { if (this.dragging) { event.preventDefault(); element.addClass("is-drop-before"); } });
    header.addEventListener("dragleave", () => element.removeClass("is-drop-before"));
    header.addEventListener("drop", (event) => {
      if (!this.dragging) return;
      event.preventDefault(); event.stopPropagation();
      if (this.dragging !== id) {
        const side = (["left", "right", "bottom"] as const).find((key) => this.state[key].includes(id));
        if (side) this.place(this.dragging, side, id);
      }
      this.finishDrag();
    });
    const panel = { element, actions, label, body: element.createDiv({ cls: "vtt-dock-panel-body" }) };
    this.panels.set(id, panel); this.render(); return panel;
  }
  showMenu(anchor: HTMLElement): void {
    const menu = new Menu();
    for (const [id, panel] of this.panels) {
      menu.addItem((item) => item.setTitle(panel.label).setChecked(!this.state.hidden.includes(id)).onClick(() => {
        this.place(id, this.state.hidden.includes(id) ? (id === "properties" ? "right" : id === "history" ? "bottom" : "left") : "hidden");
      }));
    }
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Restaurar layout").onClick(() => { this.state = defaultDockState(); this.render(); this.changed(this.snapshot()); }));
    const rect = anchor.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
  }
  snapshot(): DockState { return structuredClone(this.state); }
  restore(value: unknown): void { this.state = readDockState(value); this.render(); }
  private place(id: PanelId, side: DockSide | "hidden", before?: PanelId): void {
    this.state = movePanel(this.state, id, side, before); this.render(); this.changed(this.snapshot());
  }
  private finishDrag(): void {
    this.dragging = undefined; this.root.removeClass("is-dragging");
    this.root.querySelectorAll(".is-drop-target, .is-drop-before").forEach((item) => item.classList.remove("is-drop-target", "is-drop-before"));
  }
  private render(): void {
    for (const side of ["left", "right", "bottom"] as const) {
      for (const id of this.state[side]) { const panel = this.panels.get(id); if (panel) { panel.element.hidden = false; this.zones[side].append(panel.element); } }
      this.root.classList.toggle(`vtt-empty-${side}`, !this.state[side].length);
    }
    for (const id of this.state.hidden) { const panel = this.panels.get(id); if (panel) panel.element.hidden = true; }
    for (const side of ["left", "right"] as const) this.root.style.setProperty(`--vtt-${side}-width`, `${this.state[`${side}Width`]}px`);
    this.leftHandle.setAttribute("aria-valuenow", String(this.state.leftWidth));
    this.rightHandle.setAttribute("aria-valuenow", String(this.state.rightWidth));
  }
  private resizer(side: "left" | "right"): HTMLElement {
    const handle = this.root.createEl("button", { cls: `vtt-dock-resizer vtt-dock-resizer-${side}`, attr: { type: "button", role: "separator", "aria-label": `Largura do encaixe ${side === "left" ? "esquerdo" : "direito"}`, "aria-orientation": "vertical", "aria-valuemin": "180", "aria-valuemax": "400" } });
    let start: { x: number; width: number } | undefined;
    const update = (width: number): void => { this.state[`${side}Width`] = Math.max(180, Math.min(400, width)); this.render(); };
    handle.addEventListener("pointerdown", (event) => { if (event.button !== 0) return; start = { x: event.clientX, width: this.state[`${side}Width`] }; handle.setPointerCapture(event.pointerId); event.preventDefault(); });
    handle.addEventListener("pointermove", (event) => { if (start) update(start.width + (event.clientX - start.x) * (side === "left" ? 1 : -1)); });
    const finish = (): void => { if (start) this.changed(this.snapshot()); start = undefined; };
    handle.addEventListener("pointerup", (event) => { finish(); if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); });
    handle.addEventListener("pointercancel", finish); handle.addEventListener("lostpointercapture", finish);
    handle.addEventListener("keydown", (event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); update(this.state[`${side}Width`] + (event.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1)); this.changed(this.snapshot()); });
    return handle;
  }
}
