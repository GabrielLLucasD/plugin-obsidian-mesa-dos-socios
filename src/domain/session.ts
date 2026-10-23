/** Configuração de uma mesa. A identidade não é uma credencial de acesso. */
export class Session {
  readonly id: string;
  readonly maxPlayers: number;

  constructor(id: string, maxPlayers: number) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error("A sessão precisa de um identificador.");
    }

    Session.validateCapacity(maxPlayers);
    this.id = id;
    this.maxPlayers = maxPlayers;
    Object.freeze(this);
  }

  static validateCapacity(maxPlayers: number): void {
    if (!Number.isSafeInteger(maxPlayers) || maxPlayers <= 0) {
      throw new Error(
        "A quantidade de jogadores deve ser um inteiro positivo.",
      );
    }
  }
}
