import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
import type { SessionService } from "../application/session-service";
import { CreateSessionModal } from "../ui/create-session-modal";

export function registerSessionCommands(
  plugin: Plugin,
  sessions: SessionService,
  isActive: () => boolean,
): void {
  let modal: CreateSessionModal | undefined;

  plugin.register(() => {
    modal?.close();
    modal = undefined;
  });

  plugin.addCommand({
    id: "criar-sessao",
    name: "Criar sessão",
    callback: () => {
      if (!isActive()) return;
      if (sessions.current) {
        new Notice("Já existe uma sessão criada. Use Consultar sessão para vê-la.");
        return;
      }

      modal?.close();
      modal = new CreateSessionModal(plugin.app, (maxPlayers) => {
        if (!isActive()) throw new Error("O plugin foi desativado.");

        const session = sessions.create(maxPlayers);
        new Notice(`Sessão criada para até ${session.maxPlayers} jogadores.`);
      });
      modal.open();
    },
  });

  plugin.addCommand({
    id: "consultar-sessao",
    name: "Consultar sessão",
    callback: () => {
      if (!isActive()) return;
      const session = sessions.current;

      if (!session) {
        new Notice("Nenhuma sessão criada.");
        return;
      }

      new Notice(
        `Sessão: ${session.id}\nCapacidade: ${session.maxPlayers} jogadores.`,
        10000,
      );
    },
  });
}
