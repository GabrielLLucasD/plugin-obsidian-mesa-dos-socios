import { Plugin, Notice } from "obsidian";
import { randomUUID } from "node:crypto";
import { SessionService } from "./application/session-service";
import { registerSessionCommands } from "./commands/session-commands";
import { LocalServer } from "./server/local-server";
import { HostingService } from "./application/hosting-service";
import { RoomAccess } from "./application/room-access";
import { createAccessDependencies } from "./infrastructure/access-dependencies";
import { TableView, TABLE_VIEW_TYPE } from "./ui/table-view";
import { CampaignService } from "./application/campaign-service";
import { VaultCampaignRepository } from "./infrastructure/vault-campaign-repository";
import { VaultCampaignTransfer } from "./infrastructure/vault-campaign-transfer";

export default class VttPlugin extends Plugin {
  private hosting: HostingService | undefined;
  private unloaded = false;

  onload(): void {
    this.unloaded = false;

    const sessions = new SessionService(randomUUID);
    const hosting = new HostingService(
      sessions,
      (session) => new RoomAccess(session, createAccessDependencies()),
      (access) => new LocalServer(access),
    );
    this.hosting = hosting;
    const commands = registerSessionCommands(this, hosting, () => !this.unloaded);
    const campaigns = new CampaignService(new VaultCampaignRepository(this.app.vault), randomUUID);
    const transfer = new VaultCampaignTransfer(this.app.vault);
    this.registerView(TABLE_VIEW_TYPE, (leaf) => new TableView(leaf, {
      create: () => { commands.create.callback?.(); },
      manage: () => { commands.manage.callback?.(); },
      end: () => { commands.end.callback?.(); },
      snapshot: () => {
        if (this.unloaded || !hosting.url || !hosting.access) return undefined;
        try {
          const room = hosting.access.room;
          return { id: room.id, capacity: room.maxPlayers, players: hosting.access.listPlayers(),
            pending: hosting.access.listRequests().filter((request) => request.status === "pending").length };
        } catch { return undefined; } // A sala pode estar encerrando.
      },
    }, campaigns, transfer));
    const openTable = (): void => {
      void this.openTable().catch((error: unknown) => {
        new Notice(error instanceof Error ? error.message : "Não foi possível abrir a mesa.");
      });
    };
    this.addCommand({ id: "abrir-mesa", name: "Abrir mesa", callback: openTable });
    this.addRibbonIcon("dices", "Abrir mesa", openTable);
  }

  private async openTable(): Promise<void> {
    if (this.unloaded) return;
    const existing = this.app.workspace.getLeavesOfType(TABLE_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: TABLE_VIEW_TYPE, active: true });
    if (!this.unloaded) await this.app.workspace.revealLeaf(leaf);
  }

  onunload(): void {
    this.unloaded = true;

    void this.hosting?.stop().catch((error: unknown) => {
      console.error(
        "Obsidian VTT: falha ao encerrar o servidor.",
        error,
      );
    });
  }
}
