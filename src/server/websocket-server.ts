import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { setInterval, clearInterval } from "node:timers";
import { WebSocket, WebSocketServer } from "ws";

import { parseClientMessage } from "../shared/protocol";
import type { ServerMessage } from "../shared/protocol";
import type { RoomAccess } from "../application/room-access";
import { cookieNames, readCookie } from "./session-http";
import { RateLimit } from "./rate-limit";

export function attachWebSocket(
  httpServer: Server,
  allowedOrigin: string,
  access: RoomAccess,
): () => Promise<void> {
  const identities = new Map<WebSocket, { token: string; playerId: string }>();
  const handshakes = new RateLimit(120, 60_000);
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });

  wss.on("error", (error: Error) => {
    console.error("Obsidian VTT: erro no WebSocket.", error);
  });

  wss.on("connection", (socket) => {
    let count = 0;
    let windowEnds = Date.now() + 10_000;
    socket.on("close", () => identities.delete(socket));
    socket.on("error", (error: Error) => {
      console.warn("Obsidian VTT: conexão encerrada com erro.", (error as NodeJS.ErrnoException).code ?? "SOCKET_ERROR");
    });

    socket.on("message", (data, isBinary) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const identity = identities.get(socket);
      try {
        if (!identity) throw new Error();
        access.authenticate(identity.token);
      } catch { socket.close(1008, "unauthenticated"); return; }
      if (Date.now() >= windowEnds) { count = 0; windowEnds = Date.now() + 10_000; }
      if (++count > 60 || socket.bufferedAmount > 64 * 1024) {
        socket.close(1008, "rate-limit"); return;
      }

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
      request.headers.origin !== allowedOrigin ||
      request.headers.host !== new URL(allowedOrigin).host
    ) {
      socket.end(
        "HTTP/1.1 403 Forbidden\r\n" +
        "Connection: close\r\n" +
        "Content-Length: 0\r\n\r\n", () => socket.destroy(),
      );
      return;
    }

    if (!handshakes.allow(request.socket.remoteAddress ?? "unknown")) {
      socket.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", () => socket.destroy());
      return;
    }
    const token = readCookie(request, cookieNames(allowedOrigin).session);
    let playerId: string;
    try { playerId = access.authenticate(token).player.id; }
    catch {
      socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", () => socket.destroy());
      return;
    }
    const connections = [...identities.values()].filter((identity) => identity.playerId === playerId).length;
    if (connections >= 4 || identities.size >= 64) {
      socket.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", () => socket.destroy());
      return;
    }

    wss.handleUpgrade(request, socket, head, (connection) => {
      socket.removeListener("error", onSocketError);
      identities.set(connection, { token, playerId });
      wss.emit("connection", connection, request);
    });
  }

  httpServer.on("upgrade", onUpgrade);

  const checkAccess = (): void => {
    for (const [socket, identity] of identities) {
      try { access.authenticate(identity.token); }
      catch { socket.terminate(); identities.delete(socket); }
    }
  };
  const unsubscribe = access.subscribeAccessChanges(checkAccess);
  const expiryTimer = setInterval(() => { access.prune(); checkAccess(); }, 1000);
  expiryTimer.unref();

  return () => {
    clearInterval(expiryTimer);
    unsubscribe();
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
