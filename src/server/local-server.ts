import { createServer } from "node:http";
import type { Server } from "node:http";
import { attachWebSocket } from "./websocket-server";
import page from "../client/page.html";
import clientScript from "virtual:client-script";
import type { RoomAccess } from "../application/room-access";
import { SessionHttp } from "./session-http";

export class LocalServer {
  private server: Server;
  private url: string | undefined;
  private starting: Promise<string> | undefined;
  private stopping: Promise<void> | undefined;
  private stopWebSocket: (() => Promise<void>) | undefined;

  constructor(private readonly access: RoomAccess) {
    const api = new SessionHttp(access);
    // Respondemos somente com conteúdo fixo: nenhum arquivo do vault é servido.
    this.server = createServer((request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      if (!this.url || request.headers.host !== new URL(this.url).host) {
        response.writeHead(403); response.end(); return;
      }
      const websocketSource =
        this.url?.replace("http:", "ws:") ?? "'none'";

      response.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'none'",
          "script-src 'self'",
          `connect-src 'self' ${websocketSource}`,
          "base-uri 'none'",
          "frame-ancestors 'none'",
        ].join("; "),
      );

      if (request.url?.startsWith("/api/")) {
        void api.handle(request, response, this.url);
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Método não permitido.");
        return;
      }

      if (request.url === "/") {
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
        });
        response.end(request.method === "HEAD" ? undefined : page);
        return;
      }

      if (request.url === "/client.js") {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
        });
        response.end(request.method === "HEAD" ? undefined : clientScript);
        return;
      }

      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Página não encontrada.");
    });
    this.server.maxConnections = 128;
    this.server.headersTimeout = 10_000;
    this.server.requestTimeout = 15_000;
  }

  // Promise<string>: o endereço estará disponível quando a porta abrir.
  async start(port: number = 3210): Promise<string> {
    if (this.stopping) {
      throw new Error("O servidor está encerrando. Tente iniciar novamente em instantes.");
    }
    if (this.url) return this.url;
    if (this.starting) return this.starting;

    this.starting = new Promise<string>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException): void => {
        this.server.removeListener("listening", onListening);
        if (error.code === "EADDRINUSE") {
          reject(new Error(`A porta ${port} está ocupada. Encerre a outra instância que usa essa porta e tente novamente.`));
        } else {
          reject(error);
        }
      };

      const onListening = (): void => {
        this.server.removeListener("error", onError);
        const address = this.server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Não foi possível identificar a porta do servidor."));
          return;
        }
        this.url = `http://127.0.0.1:${address.port}`;
        this.stopWebSocket = attachWebSocket(
          this.server,
          this.url,
          this.access,
        );

        resolve(this.url);
      };

      this.server.once("error", onError);
      this.server.once("listening", onListening);
      // 127.0.0.1 aceita conexões apenas deste computador.
      try {
        this.server.listen(port, "127.0.0.1");
      } catch (error) {
        this.server.removeListener("error", onError);
        this.server.removeListener("listening", onListening);
        reject(error);
      }
    });

    try {
      return await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  async stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = this.close();
    try {
      await this.stopping;
    } finally {
      this.stopping = undefined;
    }
  }

  private async close(): Promise<void> {
    // Também encerra corretamente se o plugin for desativado durante a abertura.
    if (this.starting) {
      try {
        await this.starting;
      } catch {
        return;
      }
    }
    if (!this.server.listening) return;

    const stopWebSocket = this.stopWebSocket;
    this.stopWebSocket = undefined;

    const websocketClosed = stopWebSocket?.();

    const httpClosed = new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });

      this.server.closeAllConnections();
    });

    try {
      await Promise.all([
        websocketClosed,
        httpClosed,
      ]);
    } finally {
      this.url = undefined;
    }
  }
}
