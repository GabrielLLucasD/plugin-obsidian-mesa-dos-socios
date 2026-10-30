import { Notice } from "obsidian";
import type { Plugin } from "obsidian";
import type { HostingService } from "../application/hosting-service";
import { CreateSessionModal } from "../ui/create-session-modal";
import { ManageSessionModal } from "../ui/manage-session-modal";

export function registerSessionCommands(
  plugin: Plugin,
  sessions: HostingService,
  isActive: () => boolean,
) {
  let modal: CreateSessionModal | undefined;
  let management: ManageSessionModal | undefined;

  plugin.register(() => {
    modal?.close();
    management?.close();
    modal = undefined;
  });

  const create = plugin.addCommand({
    id: "criar-sessao",
    name: "Criar sessão",
    callback: () => {
      if (!isActive()) return;
      if (sessions.current) {
        new Notice("Já existe uma sessão criada. Use Consultar sessão para vê-la.");
        return;
      }

      modal?.close();
      modal = new CreateSessionModal(plugin.app, async (maxPlayers) => {
        if (!isActive()) throw new Error("O plugin foi desativado.");

        const session = await sessions.create(maxPlayers);
        if (isActive()) {
          new Notice(`Sessão hospedada para até ${session.maxPlayers} jogadores.`);
          management?.close();
          management = new ManageSessionModal(plugin.app, sessions, () => { management = undefined; });
          management.open();
        }
      }, () => {
        void sessions.stop().catch((error: unknown) => {
          if (isActive()) new Notice(error instanceof Error ? error.message : "Falha ao cancelar hospedagem.");
        });
      }, () => { modal = undefined; });
      modal.open();
    },
  });

  const manage = plugin.addCommand({
    id: "gerenciar-sessao", name: "Gerenciar sessão e entradas",
    callback: () => {
      if (!isActive()) return;
      management?.close();
      management = new ManageSessionModal(plugin.app, sessions, () => { management = undefined; });
      management.open();
    },
  });

  const end = plugin.addCommand({
    id: "encerrar-sessao", name: "Encerrar sessão",
    callback: async () => {
      if (!isActive()) return;
      try {
        // Uma falha de apresentação não pode impedir a revogação e a parada.
        try {
          modal?.close();
          management?.close();
        } finally {
          await sessions.stop();
        }
        if (isActive()) new Notice("Sessão encerrada. Todos os acessos foram revogados.");
      } catch (error) {
        if (isActive()) new Notice(error instanceof Error ? error.message : "Falha ao encerrar.");
      }
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
  return { create, manage, end };
}
