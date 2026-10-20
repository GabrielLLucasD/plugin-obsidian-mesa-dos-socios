import { isServerMessage } from "../shared/protocol";
import type { ClientMessage } from "../shared/protocol";

function startClient(): void {
  const status = document.querySelector("#connection-status");
  const button = document.querySelector("#send-ping");
  const output = document.querySelector("#last-response");

  if (
    !(status instanceof HTMLElement) ||
    !(button instanceof HTMLButtonElement) ||
    !(output instanceof HTMLElement)
  ) {
    throw new Error("A página não contém os elementos esperados.");
  }

  const endpoint = new URL("/ws", window.location.href);
  endpoint.protocol =
    window.location.protocol === "https:" ? "wss:" : "ws:";

  const socket = new WebSocket(endpoint);
  let sequence = 0;

  socket.addEventListener("open", () => {
    status.textContent = "Conectado";
    button.disabled = false;
  });

  socket.addEventListener("close", () => {
    status.textContent = "Desconectado — atualize a página para reconectar.";
    button.disabled = true;
  });

  socket.addEventListener("error", () => {
    status.textContent = "Erro na conexão.";
    button.disabled = true;
  });

  button.addEventListener("click", () => {
    if (socket.readyState !== WebSocket.OPEN) return;

    const message: ClientMessage = {
      type: "ping",
      requestId: String(++sequence),
    };

    socket.send(JSON.stringify(message));
    output.textContent = `Ping ${message.requestId} enviado.`;
  });

  socket.addEventListener("message", (event: MessageEvent) => {
    let value: unknown;

    try {
      if (typeof event.data !== "string") {
        throw new Error("Esperávamos uma resposta de texto.");
      }

      value = JSON.parse(event.data);
    } catch {
      output.textContent = "O servidor enviou uma resposta ilegível.";
      socket.close(1008, "invalid-json");
      return;
    }

    if (!isServerMessage(value)) {
      output.textContent = "A resposta não corresponde ao protocolo.";
      socket.close(1008, "invalid-message");
      return;
    }

    output.textContent = `Pong recebido para o pedido ${value.requestId}.`;
  });
}

startClient();