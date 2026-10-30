import type { Session } from "../domain/session.ts";
import type { RoomAccess } from "./room-access.ts";
import type { SessionService } from "./session-service.ts";

export type SessionTransport = { start(): Promise<string>; stop(): Promise<void> };

/** Coordena sala e transporte; nenhuma dependência de HTTP ou Obsidian. */
export class HostingService {
  private roomAccess: RoomAccess | undefined;
  private transport: SessionTransport | undefined;
  private opening: Promise<Session> | undefined;
  private closing: Promise<void> | undefined;
  private address: string | undefined;
  private readonly sessions: SessionService;
  private readonly createAccess: (session: Session) => RoomAccess;
  private readonly createTransport: (access: RoomAccess) => SessionTransport;

  constructor(
    sessions: SessionService,
    createAccess: (session: Session) => RoomAccess,
    createTransport: (access: RoomAccess) => SessionTransport,
  ) {
    this.sessions = sessions;
    this.createAccess = createAccess;
    this.createTransport = createTransport;
  }

  get current(): Session | undefined { return this.sessions.current; }
  get access(): RoomAccess | undefined { return this.roomAccess; }
  get url(): string | undefined { return this.address; }

  create(maxPlayers: number): Promise<Session> {
    if (this.opening || this.closing || this.current) return Promise.reject(new Error("Já existe uma sessão ou operação em andamento."));
    this.opening = this.open(maxPlayers);
    return this.opening;
  }

  private async open(maxPlayers: number): Promise<Session> {
    // Garante que opening seja atribuído antes do finally, inclusive em falhas síncronas.
    await Promise.resolve();
    try {
      const session = this.sessions.create(maxPlayers);
      const access = this.createAccess(session);
      this.roomAccess = access;
      this.transport = this.createTransport(access);
      this.address = await this.transport.start();
      if (this.closing) throw new Error("A hospedagem foi cancelada.");
      return session;
    } catch (error) {
      this.roomAccess?.close();
      await this.transport?.stop();
      this.reset();
      throw error;
    } finally { this.opening = undefined; }
  }

  stop(): Promise<void> {
    if (this.closing) return this.closing;
    this.roomAccess?.close();
    this.closing = this.finish();
    return this.closing;
  }

  private async finish(): Promise<void> {
    try {
      try { await this.opening; } catch { /* A abertura já faz rollback. */ }
      this.roomAccess?.close();
      await this.transport?.stop();
      this.reset();
    } finally { this.closing = undefined; }
  }

  private reset(): void {
    this.roomAccess = undefined; this.transport = undefined; this.address = undefined;
    this.sessions.clear();
  }
}
