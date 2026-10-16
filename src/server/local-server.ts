import { createServer } from "node:http";
import type { Server } from "node:http";

const pagina = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Obsidian VTT — Laboratório</title>
  </head>
  <body>
    <h1>Sua mesa está no ar!</h1>
    <p>Esta página foi enviada pelo servidor do plugin Obsidian VTT.</p>
    <p>Etapa 2: servidor HTTP local. Mapas e multiplayer vêm depois.</p>
    <p>Para encerrar, execute “Parar servidor local” no Obsidian.</p>
  </body>
</html>`;

export class LocalServer {
  private server: Server;
  private url: string | undefined;
  private starting: Promise<string> | undefined;
  private stopping: Promise<void> | undefined;

  constructor() {
    // Respondemos somente com conteúdo fixo: nenhum arquivo do vault é servido.
    this.server = createServer((request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");

      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Método não permitido.");
        return;
      }

      if (request.url !== "/") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Página não encontrada.");
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(request.method === "HEAD" ? undefined : pagina);
    });
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

    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        this.url = undefined;
        if (error) reject(error);
        else resolve();
      });
      this.server.closeAllConnections();
    });
  }
}
