import { Session } from "../domain/session.ts";

/** Mantém uma sessão local por instância, sem depender de UI ou transporte. */
export class SessionService {
  private currentSession: Session | undefined;
  private readonly generateId: () => string;

  constructor(generateId: () => string) {
    this.generateId = generateId;
  }

  get current(): Session | undefined {
    return this.currentSession;
  }

  clear(): void {
    this.currentSession = undefined;
  }

  create(maxPlayers: number): Session {
    if (this.currentSession) {
      throw new Error("Já existe uma sessão criada.");
    }

    // Valida antes de consumir uma identidade e só publica o estado no sucesso.
    Session.validateCapacity(maxPlayers);
    const session = new Session(this.generateId(), maxPlayers);
    this.currentSession = session;
    return session;
  }
}
