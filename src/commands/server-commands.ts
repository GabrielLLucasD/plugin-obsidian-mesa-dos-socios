import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
import type { LocalServer } from "../server/local-server";

export function registerServerCommands(
    plugin: Plugin,
    server: LocalServer,
    isActive: () => boolean,
): void
{
    plugin.addCommand({
        id: "iniciar-servidor-local",
        name: "Iniciar Servidor RPG",
        callback: async () => {
            try {
                const url = await server.start();
                if (isActive()) {
                    new Notice(`Servidor local ativo: ${url}`, 15000);
                }

            } catch (error) {
                const message =
                    error instanceof Error ?
                        error.message :
                        String(error);

                console.error("Obsidian VTT:", error);
                if (isActive()) {
                    new Notice(`Obsidian VTT: ${message}`, 15000);
}
            }
        }
    });
}
