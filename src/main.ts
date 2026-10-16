import { Notice, Plugin } from "obsidian";
import { LocalServer } from "./server/local-server";
import { registerServerCommands } from "./commands/server-commands";

export default class VttPlugin extends Plugin {
  private server = new LocalServer();
  private unloaded = false;

  // Método inicial assim que o plugin é ativado
  onload(): void {
    this.unloaded = false;
    this.addCommand({
      id: "testar-mesa",
      name: "Testar mesa",
      callback: () => {
        const mensagem: string = "Olá amigos da mesa virtual";
        new Notice(mensagem);
      },
    });

    registerServerCommands(
      this,
      this.server,
      () => !this.unloaded,
    );

    this.addCommand({
      id: "parar-servidor-local",
      name: "Parar servidor local",
      callback: () => this.stopServer(),
    });
  }


  private async stopServer(): Promise<void> {
    try {
      await this.server.stop();
      if (!this.unloaded) new Notice("Servidor local parado.");
    } catch (error) {
      this.showError(error);
    }
  }

  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Obsidian VTT:", error);
    if (!this.unloaded) new Notice(`Obsidian VTT: ${message}`, 12000);
  }

  onunload(): void {
    this.unloaded = true;
    // O Obsidian não aguarda um onunload assíncrono; tratamos a falha aqui.
    void this.server.stop().catch((error: unknown) => this.showError(error));
  }
}
