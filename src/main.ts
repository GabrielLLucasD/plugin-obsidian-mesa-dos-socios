import { Plugin } from "obsidian";
import { registerServerCommands } from "./commands/server-commands";
import { LocalServer } from "./server/local-server";

export default class VttPlugin extends Plugin {
  private server = new LocalServer();
  private unloaded = false;

  onload(): void {
    this.unloaded = false;

    registerServerCommands(
      this,
      this.server,
      () => !this.unloaded,
    );
  }

  onunload(): void {
    this.unloaded = true;

    void this.server.stop().catch((error: unknown) => {
      console.error(
        "Obsidian VTT: falha ao encerrar o servidor.",
        error,
      );
    });
  }
}