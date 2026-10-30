import { Notice, setIcon, setTooltip } from "obsidian";

export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void | Promise<void>): HTMLButtonElement {
  const button = parent.createEl("button", { cls: "vtt-icon-button", attr: { type: "button", "aria-label": label } });
  setIcon(button, icon);
  setTooltip(button, label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void Promise.resolve().then(action).catch((error: unknown) => new Notice(error instanceof Error ? error.message : "Falha na operação."));
  });
  return button;
}
