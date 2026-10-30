import { TFile, TFolder, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import type { Vault } from "obsidian";
import { validateCampaign } from "../application/campaign-service";
import type { Campaign, CampaignDocument, CampaignRepository } from "../application/campaign-service";

export class VaultCampaignRepository implements CampaignRepository {
  constructor(private readonly vault: Vault) {}
  async create(campaign: Campaign): Promise<CampaignDocument> {
    const name = campaign.name.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "");
    if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)) throw new Error("Escolha outro nome para a pasta da campanha.");
    const root = `Campanhas/${name}`;
    if (this.vault.getAbstractFileByPath(root)) throw new Error("Já existe uma pasta com esse nome. Abra a campanha ou escolha outro nome.");
    const base = this.vault.getAbstractFileByPath("Campanhas");
    if (base && !(base instanceof TFolder)) throw new Error("Campanhas precisa ser uma pasta.");
    if (!base) await this.vault.createFolder("Campanhas");
    await this.vault.createFolder(root);
    // Em caso de falha, preservamos os arquivos já criados para recuperação manual.
    for (const folder of ["Cenas", "Tokens", "Personagens", "Notas do mestre"]) await this.vault.createFolder(`${root}/${folder}`);
    const path = `${root}/campanha.yaml`;
    const source = stringifyYaml(campaign);
    await this.vault.create(path, source);
    return { path, source, campaign };
  }
  async load(path: string): Promise<CampaignDocument> {
    const file = this.file(path);
    const source = await this.vault.read(file);
    return { path: file.path, source, campaign: validateCampaign(parseYaml(source)) };
  }
  async save(previous: CampaignDocument, campaign: Campaign): Promise<CampaignDocument> {
    const file = this.file(previous.path);
    const source = stringifyYaml(campaign);
    await this.vault.process(file, (current) => {
      if (current !== previous.source) throw new Error("A campanha foi alterada fora da mesa. Abra o arquivo novamente antes de editar cenas.");
      return source;
    });
    return { path: file.path, source, campaign };
  }
  private file(path: string): TFile {
    if (path.split(/[\\/]/).includes("..") || /^[\\/]|^[A-Za-z]:/.test(path)) throw new Error("Use um caminho relativo ao cofre.");
    const file = this.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile) || !/\.ya?ml$/i.test(file.path)) throw new Error("Selecione um arquivo YAML de campanha existente no cofre.");
    return file;
  }
}
