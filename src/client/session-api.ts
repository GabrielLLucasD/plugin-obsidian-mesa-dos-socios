import { isJoinRequestView, isMeView, isRoomView } from "../shared/access-contracts";

export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, validate: (value: unknown) => value is T, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const value: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    let message = `Falha na requisição (${response.status}).`;
    if (value && typeof value === "object" && "error" in value && value.error &&
      typeof value.error === "object" && "message" in value.error && typeof value.error.message === "string") {
      message = value.error.message;
    }
    throw new ApiFailure(response.status, message);
  }
  if (!validate(value)) throw new Error("Resposta fora do contrato da API.");
  return value;
}

function isOk(value: unknown): value is { ok: true } {
  return value !== null && typeof value === "object" && "ok" in value && value.ok === true;
}

export const sessionApi = {
  room: () => request("/api/session", isRoomView),
  me: () => request("/api/me", isMeView),
  join: (displayName: string, invite: string) => request("/api/join-requests", isJoinRequestView, { displayName, invite }),
  pending: () => request("/api/join-request", isJoinRequestView),
  claim: () => request("/api/claim", isMeView, {}),
  logout: () => request("/api/logout", isOk, {}),
};
