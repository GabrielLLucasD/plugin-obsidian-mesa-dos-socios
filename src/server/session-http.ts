import type { IncomingMessage, ServerResponse } from "node:http";
import { RoomAccess, ACCESS_POLICY } from "../application/room-access";
import { AccessError } from "../application/access-error";
import type { ApiErrorCode } from "../shared/access-contracts";
import { RateLimit } from "./rate-limit";

const statusCodes: Record<ApiErrorCode, number> = {
  ROOM_CLOSED: 410, ROOM_FULL: 409, ENTRY_CLOSED: 403, INVALID_INVITE: 403,
  INVALID_NAME: 400, INVALID_REQUEST: 400, REQUEST_EXPIRED: 410, REQUEST_NOT_PENDING: 409,
  NOT_APPROVED: 403, UNAUTHENTICATED: 401, NOT_FOUND: 404, TOO_MANY_REQUESTS: 429,
  FORBIDDEN: 403, BODY_TOO_LARGE: 413, UNSUPPORTED_MEDIA_TYPE: 415, INTERNAL_ERROR: 500,
};

export function cookieNames(origin: string): { session: string; request: string } {
  const port = new URL(origin).port;
  return { session: `vtt_${port}_session`, request: `vtt_${port}_request` };
}

export function readCookie(request: IncomingMessage, name: string): string {
  const values = (request.headers.cookie ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return "";
  const value = values[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}

function cookie(name: string, value: string, ttlMs: number): string {
  // HTTP é restrito a loopback. Secure deverá acompanhar a futura implantação HTTPS.
  return `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(ttlMs / 1000)}`;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";")[0]?.trim() !== "application/json") {
    throw new AccessError("UNSUPPORTED_MEDIA_TYPE", "Use application/json.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  // Consome sem reter conteúdo adicional quando o corpo exceder o limite.
  return new Promise((resolve, reject) => {
    let exceeded = false;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4096) {
        if (!exceeded) { exceeded = true; reject(new AccessError("BODY_TOO_LARGE", "Corpo maior que 4 KiB.")); }
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (exceeded) return;
      try {
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        resolve(value as Record<string, unknown>);
      } catch { reject(new AccessError("INVALID_REQUEST", "JSON inválido.")); }
    });
    request.on("error", () => reject(new AccessError("INVALID_REQUEST", "Leitura interrompida.")));
    request.on("aborted", () => reject(new AccessError("INVALID_REQUEST", "Requisição interrompida.")));
  });
}

export class SessionHttp {
  private readonly requests = new RateLimit(600, 60_000);
  private readonly attempts = new RateLimit(20, 60_000);
  constructor(private readonly access: RoomAccess) {}

  async handle(request: IncomingMessage, response: ServerResponse, origin: string): Promise<void> {
    try {
      const ip = request.socket.remoteAddress ?? "unknown";
      if (!this.requests.allow(ip)) throw new AccessError("TOO_MANY_REQUESTS", "Aguarde antes de tentar novamente.");
      if (request.method === "POST" && request.headers.origin !== origin) {
        throw new AccessError("FORBIDDEN", "Origem não permitida.");
      }
      const names = cookieNames(origin);
      const token = readCookie(request, names.session);
      const ticket = readCookie(request, names.request);
      const route = `${request.method} ${request.url}`;
      const body = request.method === "POST" &&
        ["/api/join-requests", "/api/claim", "/api/logout"].includes(request.url ?? "")
        ? await readJson(request) : {};

      switch (route) {
        case "GET /api/session":
          json(response, 200, this.access.room); return;
        case "POST /api/join-requests": {
          if (!this.attempts.allow(ip)) throw new AccessError("TOO_MANY_REQUESTS", "Muitas tentativas de entrada.");
          // Uma identidade válida não precisa abrir uma nova solicitação.
          if (token) {
            try { this.access.authenticate(token); throw new AccessError("REQUEST_NOT_PENDING", "Você já entrou nesta sala."); }
            catch (error) { if (!(error instanceof AccessError) || error.code !== "UNAUTHENTICATED") throw error; }
          }
          if (Object.keys(body).some((key) => !["invite", "displayName"].includes(key))) {
            throw new AccessError("INVALID_REQUEST", "Campos não reconhecidos.");
          }
          const result = this.access.requestJoin(body.invite, body.displayName, ticket);
          response.setHeader("Set-Cookie", cookie(names.request, result.ticket, result.request.expiresAt - Date.now()));
          json(response, 202, result.request); return;
        }
        case "GET /api/join-request":
          json(response, 200, this.access.requestStatus(ticket)); return;
        case "POST /api/claim": {
          if (Object.keys(body).length) throw new AccessError("INVALID_REQUEST", "Envie um objeto vazio.");
          // Repetição após perda da resposta não gira uma credencial que já chegou ao cliente.
          if (token) {
            try { json(response, 200, this.access.authenticate(token)); return; }
            catch (error) { if (!(error instanceof AccessError) || error.code !== "UNAUTHENTICATED") throw error; }
          }
          const result = this.access.claim(ticket);
          response.setHeader("Set-Cookie", cookie(names.session, result.token, ACCESS_POLICY.credentialTtlMs));
          json(response, 200, result.me); return;
        }
        case "GET /api/me":
          json(response, 200, this.access.authenticate(token)); return;
        case "POST /api/logout":
          if (Object.keys(body).length) throw new AccessError("INVALID_REQUEST", "Envie um objeto vazio.");
          this.access.logout(token);
          response.setHeader("Set-Cookie", [cookie(names.session, "", 0), cookie(names.request, "", 0)]);
          json(response, 200, { ok: true }); return;
        default:
          throw new AccessError("NOT_FOUND", "Rota inexistente.");
      }
    } catch (error) {
      if (response.destroyed || response.headersSent) return;
      const failure = error instanceof AccessError ? error : new AccessError("INTERNAL_ERROR", "Falha interna.");
      if (failure.code === "TOO_MANY_REQUESTS") response.setHeader("Retry-After", "60");
      json(response, statusCodes[failure.code], { error: { code: failure.code, message: failure.message } });
    }
  }
}
