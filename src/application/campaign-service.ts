export type Scene = { id: string; name: string };
export type Campaign = { version: 1; id: string; name: string; scenes: Scene[] };
export type CampaignDocument = { path: string; source: string; campaign: Campaign };
export interface CampaignRepository {
  create(campaign: Campaign): Promise<CampaignDocument>;
  load(path: string): Promise<CampaignDocument>;
  save(previous: CampaignDocument, campaign: Campaign): Promise<CampaignDocument>;
}

export function validName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80 || /[\u0000-\u001f]/u.test(value)) {
    throw new Error("Informe um nome entre 1 e 80 caracteres, sem caracteres de controle.");
  }
  return value.trim();
}

export function validateCampaign(value: unknown): Campaign {
  if (!value || typeof value !== "object") throw new Error("Campanha inválida.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || typeof data.id !== "string" || !data.id || !Array.isArray(data.scenes)) {
    throw new Error("Formato de campanha inválido ou versão não suportada.");
  }
  if (Object.keys(data).some((key) => !["version", "id", "name", "scenes"].includes(key))) {
    throw new Error("A campanha contém campos não suportados. O arquivo foi preservado.");
  }
  const ids = new Set<string>();
  const scenes = data.scenes.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Cena inválida.");
    const scene = value as Record<string, unknown>;
    if (typeof scene.id !== "string" || !scene.id || ids.has(scene.id) ||
      Object.keys(scene).some((key) => !["id", "name"].includes(key))) throw new Error("Identidade ou campos da cena inválidos.");
    ids.add(scene.id);
    return { id: scene.id, name: validName(scene.name) };
  });
  return { version: 1, id: data.id, name: validName(data.name), scenes };
}

/** Coordena persistência sem conhecer YAML, Obsidian ou a interface. */
export class CampaignService {
  private document: CampaignDocument | undefined;
  private busy = false;
  private readonly repository: CampaignRepository;
  private readonly newId: () => string;
  constructor(repository: CampaignRepository, newId: () => string) {
    this.repository = repository;
    this.newId = newId;
  }
  get current(): CampaignDocument | undefined {
    return this.document ? structuredClone(this.document) : undefined;
  }
  create(name: string): Promise<void> {
    return this.run(async () => {
      const campaign: Campaign = { version: 1, id: this.newId(), name: validName(name), scenes: [] };
      this.document = await this.repository.create(campaign);
    });
  }
  open(path: string): Promise<void> {
    return this.run(async () => { this.document = await this.repository.load(path); });
  }
  addScene(name: string): Promise<void> {
    return this.update((campaign) => { campaign.scenes.push({ id: this.newId(), name: validName(name) }); });
  }
  renameScene(id: string, name: string): Promise<void> {
    return this.update((campaign) => {
      const scene = campaign.scenes.find((item) => item.id === id);
      if (!scene) throw new Error("Cena não encontrada.");
      scene.name = validName(name);
    });
  }
  removeScene(id: string): Promise<void> {
    return this.update((campaign) => {
      if (!campaign.scenes.some((item) => item.id === id)) throw new Error("Cena não encontrada.");
      campaign.scenes = campaign.scenes.filter((item) => item.id !== id);
    });
  }
  private update(change: (campaign: Campaign) => void): Promise<void> {
    return this.run(async () => {
      if (!this.document) throw new Error("Abra ou crie uma campanha primeiro.");
      const campaign = structuredClone(this.document.campaign);
      change(campaign);
      this.document = await this.repository.save(this.document, validateCampaign(campaign));
    });
  }
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) throw new Error("Aguarde a operação atual terminar.");
    this.busy = true;
    try { await action(); } finally { this.busy = false; }
  }
}
