import { isServerMessage } from "../shared/protocol";
import type { ClientMessage } from "../shared/protocol";
import { ApiFailure, sessionApi } from "./session-api";

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Elemento ausente: ${id}`);
  return value as T;
}

function startClient(): void {
  const status = element("connection-status");
  const button = element<HTMLButtonElement>("send-ping");
  const output = element("last-response");
  const form = element<HTMLFormElement>("join-form");
  const name = element<HTMLInputElement>("display-name");
  const invite = element<HTMLInputElement>("invite");
  const entry = element("entry-status");
  const submit = element<HTMLButtonElement>("request-entry");
  const logout = element<HTMLButtonElement>("logout");
  let socket: WebSocket | undefined;
  let timer: number | undefined;
  let disposed = false;
  let authenticated = false;
  let sequence = 0;
  let retryMs = 1000;

  const describe = (error: unknown): string => error instanceof Error ? error.message : "Falha inesperada.";
  const schedule = (action: () => Promise<void>, delay: number): void => {
    window.clearTimeout(timer);
    if (!disposed) timer = window.setTimeout(() => { void action(); }, delay);
  };
  const showLogin = (message: string): void => {
    authenticated = false;
    button.disabled = true;
    logout.hidden = true;
    form.hidden = false;
    status.textContent = "Entrada necessária";
    entry.textContent = message;
  };

  async function reconnect(): Promise<void> {
    if (!authenticated || disposed) return;
    try {
      await sessionApi.me();
      if (!disposed && authenticated) connect();
    } catch (error) {
      if (disposed) return;
      if (error instanceof ApiFailure && [401, 410].includes(error.status)) {
        showLogin("Acesso expirado ou revogado. Solicite ao mestre a liberação da sua vaga antes de entrar novamente.");
      } else {
        status.textContent = "Sem conexão. Tentando novamente...";
        retryMs = Math.min(retryMs * 2, 10000);
        schedule(reconnect, error instanceof ApiFailure && error.status === 429 ? 60_000 : retryMs);
      }
    }
  }

  function connect(): void {
    if (disposed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const endpoint = new URL("/ws", window.location.href);
    endpoint.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(endpoint);
    const connection = socket;
    connection.addEventListener("open", () => {
      retryMs = 1000;
      status.textContent = "Conectado e autenticado";
      button.disabled = false;
    });
    connection.addEventListener("close", () => {
      button.disabled = true;
      if (authenticated && !disposed) {
        status.textContent = "Desconectado. Reconectando...";
        schedule(reconnect, retryMs);
      }
    });
    connection.addEventListener("error", () => { status.textContent = "Erro de conexão."; });
    connection.addEventListener("message", (event: MessageEvent) => {
      try {
        if (typeof event.data !== "string") throw new Error();
        const value: unknown = JSON.parse(event.data);
        if (!isServerMessage(value)) throw new Error();
        output.textContent = `Pong recebido para o pedido ${value.requestId}.`;
      } catch { output.textContent = "Resposta fora do protocolo."; connection.close(1008, "invalid-message"); }
    });
  }

  async function enter(): Promise<void> {
    const me = await sessionApi.me();
    if (disposed) return;
    authenticated = true;
    form.hidden = true;
    logout.hidden = false;
    entry.textContent = `Jogador: ${me.player.displayName}. Vagas ocupadas: ${me.room.approvedPlayers}/${me.room.maxPlayers}.`;
    connect();
  }

  async function poll(): Promise<void> {
    if (disposed) return;
    try {
      const request = await sessionApi.pending();
      if (disposed) return;
      if (request.status === "approved") { await sessionApi.claim(); await enter(); return; }
      if (request.status === "rejected") { showLogin("O mestre rejeitou sua solicitação."); return; }
      form.hidden = true;
      status.textContent = "Aguardando aprovação";
      entry.textContent = `Pedido de ${request.displayName} enviado. O mestre precisa aprovar sua entrada.`;
      schedule(poll, 2000);
    } catch (error) {
      if (disposed) return;
      if (error instanceof ApiFailure && [403, 410].includes(error.status)) showLogin(describe(error));
      else {
        entry.textContent = describe(error);
        schedule(poll, error instanceof ApiFailure && error.status === 429 ? 60_000 : 5000);
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      await sessionApi.join(name.value, invite.value);
      invite.value = "";
      await poll();
    } catch (error) { entry.textContent = describe(error); }
    finally { submit.disabled = false; }
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      await sessionApi.logout();
      window.clearTimeout(timer);
      showLogin("Você saiu. A vaga permanece reservada; peça ao mestre para removê-la antes de solicitar uma nova entrada.");
      socket?.close();
    } catch (error) { entry.textContent = describe(error); }
    finally { logout.disabled = false; }
  });

  button.addEventListener("click", () => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    const message: ClientMessage = { type: "ping", requestId: String(++sequence) };
    socket.send(JSON.stringify(message));
    output.textContent = `Ping ${message.requestId} enviado.`;
  });

  window.addEventListener("pagehide", () => {
    disposed = true;
    window.clearTimeout(timer);
    socket?.close();
  }, { once: true });

  void enter().catch(async (error: unknown) => {
    if (disposed) return;
    if (error instanceof ApiFailure && error.status === 401) await poll();
    else showLogin(describe(error));
  });
}

startClient();
