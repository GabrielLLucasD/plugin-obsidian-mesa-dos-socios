import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

import { parseClientMessage } from "../shared/protocol";
import type { ServerMessage } from "../shared/protocol";

export function attachWebSocket(
  httpServer: Server,
  allowedOrigin: string,
): () => Promise<void> {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });

  wss.on("error", (error: Error) => {
    console.error("Obsidian VTT: erro no WebSocket.", error);
  });

  wss.on("connection", (socket) => {
    socket.on("error", (error: Error) => {
      console.error("Obsidian VTT: erro na conexão.", error);
    });

    socket.on("message", (data, isBinary) => {
      if (socket.readyState !== WebSocket.OPEN) return;

      if (isBinary) {
        socket.close(1003, "Somente mensagens de texto.");
        return;
      }

      const result = parseClientMessage(data.toString());

      if (!result.ok) {
        socket.close(1008, result.reason);
        return;
      }

      const response: ServerMessage = {
        type: "pong",
        requestId: result.message.requestId,
      };

      socket.send(JSON.stringify(response));
    });
  });

  function onUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    const onSocketError = (): void => {
      socket.destroy();
    };

    socket.on("error", onSocketError);

    if (
      request.url !== "/ws" ||
      request.headers.origin !== allowedOrigin
    ) {
      socket.end(
        "HTTP/1.1 403 Forbidden\r\n" +
        "Connection: close\r\n" +
        "Content-Length: 0\r\n\r\n",
      );
      return;
    }

    wss.handleUpgrade(request, socket, head, (connection) => {
      socket.removeListener("error", onSocketError);
      wss.emit("connection", connection, request);
    });
  }

  httpServer.on("upgrade", onUpgrade);

  return () => {
    httpServer.removeListener("upgrade", onUpgrade);

    return new Promise<void>((resolve, reject) => {
      wss.close((error) => {
        if (error) reject(error);
        else resolve();
      });

      for (const client of wss.clients) {
        client.terminate();
      }
    });
  };
}