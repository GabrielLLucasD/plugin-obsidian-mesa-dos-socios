import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
import type { LocalServer } from "../server/local-server";

export function registerServerCommands(
  plugin: Plugin,
  server: LocalServer,
  isActive: () => boolean,
): void {
  function notify(message: string): void {
    if (isActive()) {
      new Notice(message, 15000);
    }
  }

  function reportError(error: unknown): void {
    console.error("Obsidian VTT:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    notify(`Obsidian VTT: ${message}`);
  }

  plugin.addCommand({
    id: "iniciar-servidor-local",
    name: "Iniciar Servidor RPG",
    callback: async () => {
      try {
        const url = await server.start();
        notify(`Servidor local ativo: ${url}`);
      } catch (error) {
        reportError(error);
      }
    },
  });

  plugin.addCommand({
    id: "parar-servidor-local",
    name: "Parar servidor local",
    callback: async () => {
      try {
        await server.stop();
        notify("Servidor local parado.");
      } catch (error) {
        reportError(error);
      }
    },
  });
}