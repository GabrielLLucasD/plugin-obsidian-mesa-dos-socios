import type { Session } from "../domain/session.ts";
import type { JoinRequestView, PlayerView, MeView, RoomView } from "../shared/access-contracts.ts";
import { AccessError } from "./access-error.ts";

export const ACCESS_POLICY = Object.freeze({
  requestTtlMs: 10 * 60_000,
  credentialTtlMs: 8 * 60 * 60_000,
  maxRequests: 64,
});

export type AccessDependencies = {
  newId: () => string;
  newInvite: () => string;
  newSecret: () => string;
  digest: (value: string) => string;
  now: () => number;
};
type JoinRequest = JoinRequestView & { ticketHash: string; playerId?: string };
type Credential = { playerId: string; expiresAt: number };

/** Autoridade de admissão de uma sala. Métodos de mestre são somente in-process. */
export class RoomAccess {
  private readonly requests = new Map<string, JoinRequest>();
  private readonly players = new Map<string, PlayerView>();
  private readonly credentials = new Map<string, Credential>();
  private readonly listeners = new Set<() => void>();
  private inviteCode: string;
  private closed = false;
  private accepting = true;
  readonly session: Session;
  private readonly dependencies: AccessDependencies;

  constructor(session: Session, dependencies: AccessDependencies) {
    this.session = session;
    this.dependencies = dependencies;
    this.inviteCode = dependencies.newInvite();
  }

  get invite(): string { this.ensureOpen(); return this.inviteCode; }

  get room(): RoomView {
    this.ensureOpen();
    return { id: this.session.id, maxPlayers: this.session.maxPlayers,
      approvedPlayers: this.players.size, acceptingRequests: this.accepting };
  }

  listRequests(): JoinRequestView[] {
    this.ensureOpen(); this.prune();
    return [...this.requests.values()].map((request) => this.requestView(request));
  }

  listPlayers(): PlayerView[] {
    this.ensureOpen();
    return [...this.players.values()].map((player) => ({ ...player }));
  }

  requestJoin(invite: unknown, name: unknown, previousTicket?: string): {
    ticket: string; request: JoinRequestView;
  } {
    this.ensureOpen(); this.prune();
    if (!this.accepting) throw new AccessError("ENTRY_CLOSED", "Novas entradas estão bloqueadas.");
    if (typeof invite !== "string" || invite.length > 128 ||
      this.dependencies.digest(invite.replace(/[\s-]/gu, "").toUpperCase()) !==
        this.dependencies.digest(this.inviteCode.replace(/-/g, ""))) {
      throw new AccessError("INVALID_INVITE", "Convite inválido.");
    }
    if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 40 ||
      /[\u0000-\u001f\u007f]/u.test(name)) {
      throw new AccessError("INVALID_NAME", "Informe um nome entre 1 e 40 caracteres, sem controles.");
    }
    if (previousTicket) {
      const existing = this.findRequest(previousTicket);
      if (existing && existing.status !== "rejected") {
        return { ticket: previousTicket, request: this.requestView(existing) };
      }
    }
    if (this.requests.size >= ACCESS_POLICY.maxRequests) {
      throw new AccessError("TOO_MANY_REQUESTS", "Limite de solicitações atingido. Tente mais tarde.");
    }
    const ticket = this.dependencies.newSecret();
    const request: JoinRequest = {
      id: this.dependencies.newId(), displayName: name.trim(), status: "pending",
      expiresAt: this.dependencies.now() + ACCESS_POLICY.requestTtlMs,
      ticketHash: this.dependencies.digest(ticket),
    };
    this.requests.set(request.id, request);
    return { ticket, request: this.requestView(request) };
  }

  requestStatus(ticket: string): JoinRequestView {
    return this.requestView(this.requireRequest(ticket));
  }

  approve(requestId: string): PlayerView {
    this.ensureOpen(); this.prune();
    const request = this.requests.get(requestId);
    if (!request) throw new AccessError("REQUEST_EXPIRED", "Solicitação inexistente ou expirada.");
    if (request.status !== "pending") throw new AccessError("REQUEST_NOT_PENDING", "Solicitação já decidida.");
    if (this.players.size >= this.session.maxPlayers) throw new AccessError("ROOM_FULL", "A sala está cheia.");
    // Sem await entre conferir a vaga e publicar a admissão: transição atômica nesta instância.
    const player = Object.freeze({ id: this.dependencies.newId(), displayName: request.displayName });
    this.players.set(player.id, player);
    request.playerId = player.id;
    request.status = "approved";
    return { ...player };
  }

  reject(requestId: string): void {
    this.ensureOpen(); this.prune();
    const request = this.requests.get(requestId);
    if (!request) throw new AccessError("REQUEST_EXPIRED", "Solicitação inexistente ou expirada.");
    if (request.status !== "pending") throw new AccessError("REQUEST_NOT_PENDING", "Solicitação já decidida.");
    request.status = "rejected";
  }

  claim(ticket: string): { token: string; me: MeView } {
    const request = this.requireRequest(ticket);
    const player = request.playerId ? this.players.get(request.playerId) : undefined;
    if (request.status !== "approved" || !player) throw new AccessError("NOT_APPROVED", "Entrada ainda não aprovada.");
    const token = this.dependencies.newSecret();
    const tokenHash = this.dependencies.digest(token);
    const expiresAt = this.dependencies.now() + ACCESS_POLICY.credentialTtlMs;
    this.deleteCredentials(player.id);
    this.credentials.set(tokenHash, { playerId: player.id, expiresAt });
    this.changed();
    return { token, me: { player: { ...player }, room: this.room, expiresAt } };
  }

  authenticate(token: string): MeView {
    this.ensureOpen();
    const hash = this.dependencies.digest(token);
    const credential = this.credentials.get(hash);
    if (!credential || credential.expiresAt <= this.dependencies.now()) {
      if (credential) this.credentials.delete(hash);
      throw new AccessError("UNAUTHENTICATED", "Acesso inválido ou expirado.");
    }
    const player = this.players.get(credential.playerId);
    if (!player) throw new AccessError("UNAUTHENTICATED", "Acesso revogado.");
    return { player: { ...player }, room: this.room, expiresAt: credential.expiresAt };
  }

  logout(token: string): void {
    const me = this.authenticate(token);
    this.deleteCredentials(me.player.id);
    // Impede recuperar o acesso pelo ticket anterior após logout.
    this.invalidateRequests(me.player.id);
    this.changed();
  }

  removePlayer(playerId: string): void {
    this.ensureOpen();
    if (!this.players.delete(playerId)) throw new AccessError("NOT_FOUND", "Participante inexistente.");
    this.deleteCredentials(playerId);
    this.invalidateRequests(playerId);
    this.changed();
  }

  rotateInvite(): string {
    this.ensureOpen();
    const next = this.dependencies.newInvite();
    this.inviteCode = next;
    // Pedidos já recebidos continuam sujeitos à decisão explícita do mestre.
    return next;
  }

  setAccepting(accepting: boolean): void { this.ensureOpen(); this.accepting = accepting; }

  subscribeAccessChanges(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  prune(): void {
    const now = this.dependencies.now();
    for (const [id, request] of this.requests) if (request.expiresAt <= now) this.requests.delete(id);
    let revoked = false;
    for (const [hash, credential] of this.credentials) {
      if (credential.expiresAt <= now) { this.credentials.delete(hash); revoked = true; }
    }
    if (revoked) this.changed();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.inviteCode = "";
    this.requests.clear(); this.credentials.clear(); this.players.clear();
    this.changed(); this.listeners.clear();
  }

  private ensureOpen(): void {
    if (this.closed) throw new AccessError("ROOM_CLOSED", "A sessão foi encerrada.");
  }

  private findRequest(ticket: string): JoinRequest | undefined {
    const hash = this.dependencies.digest(ticket);
    return [...this.requests.values()].find((request) => request.ticketHash === hash);
  }

  private requireRequest(ticket: string): JoinRequest {
    this.ensureOpen(); this.prune();
    const request = this.findRequest(ticket);
    if (!request) throw new AccessError("REQUEST_EXPIRED", "Solicitação inexistente ou expirada.");
    return request;
  }

  private requestView(request: JoinRequest): JoinRequestView {
    return { id: request.id, displayName: request.displayName, status: request.status, expiresAt: request.expiresAt };
  }

  private deleteCredentials(playerId: string): void {
    for (const [hash, credential] of this.credentials) if (credential.playerId === playerId) this.credentials.delete(hash);
  }

  private invalidateRequests(playerId: string): void {
    for (const request of this.requests.values()) if (request.playerId === playerId) request.status = "rejected";
  }

  private changed(): void { for (const listener of this.listeners) listener(); }
}
