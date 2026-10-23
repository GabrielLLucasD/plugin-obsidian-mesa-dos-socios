import { Plugin } from "obsidian";
import { randomUUID } from "node:crypto";
import { SessionService } from "./application/session-service";
import { registerSessionCommands } from "./commands/session-commands";
import { registerServerCommands } from "./commands/server-commands";
import { LocalServer } from "./server/local-server";

export default class VttPlugin extends Plugin {
  private server = new LocalServer();
  private unloaded = false;

  onload(): void {
    this.unloaded = false;

    const sessions = new SessionService(randomUUID);
    registerSessionCommands(this, sessions, () => !this.unloaded);

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
