import { TFile, TFolder, parseYaml, stringifyYaml } from "obsidian";
import type { Vault } from "obsidian";
import { validateCampaign, validName } from "../application/campaign-service";
import { ARCHIVE_LIMITS, readCampaignArchive, writeCampaignArchive } from "./campaign-archive";
import type { ArchiveFiles } from "./campaign-archive";

export type CampaignImport = { name: string; restore(name: string): Promise<string> };
export interface CampaignTransfer {
  export(path: string): Promise<Uint8Array>;
  inspect(bytes: Uint8Array): CampaignImport;
}

export class VaultCampaignTransfer implements CampaignTransfer {
  constructor(private readonly vault: Vault) {}
  async export(path: string): Promise<Uint8Array> {
    const manifest = this.vault.getAbstractFileByPath(path);
    if (!(manifest instanceof TFile) || manifest.name !== "campanha.yaml" || !manifest.parent?.path) {
      throw new Error("Exporte uma campanha com campanha.yaml em sua própria pasta.");
    }
    validateCampaign(parseYaml(await this.vault.read(manifest)));
    const root = manifest.parent.path + "/";
    const selected = this.vault.getFiles().filter((file) => file.path.startsWith(root) &&
      !file.path.slice(root.length).split("/").some((part) => part.startsWith(".")));
    if (selected.length > ARCHIVE_LIMITS.files || selected.reduce((sum, file) => sum + file.stat.size, 0) > ARCHIVE_LIMITS.bytes) {
      throw new Error("Campanha excede o limite de 1000 arquivos ou 128 MiB.");
    }
    const files: ArchiveFiles = Object.create(null) as ArchiveFiles;
    for (const file of selected) files[file.path.slice(root.length)] = new Uint8Array(await this.vault.readBinary(file));
    return writeCampaignArchive(files);
  }
  inspect(bytes: Uint8Array): CampaignImport {
    const files = readCampaignArchive(bytes);
    const campaign = validateCampaign(parseYaml(new TextDecoder("utf-8", { fatal: true }).decode(files["campanha.yaml"])));
    return { name: campaign.name, restore: async (name) => {
      const title = validName(name);
      if (/[<>:"/\\|?*]/.test(title) || /[. ]$/.test(title) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(title)) {
        throw new Error("Escolha um nome de pasta válido.");
      }
      const root = `Campanhas/${title}`;
      if (this.vault.getAbstractFileByPath(root)) throw new Error("Essa campanha já existe. Escolha outro nome para importar uma cópia.");
      const base = this.vault.getAbstractFileByPath("Campanhas");
      if (base && !(base instanceof TFolder)) throw new Error("Campanhas precisa ser uma pasta.");
      if (!base) await this.vault.createFolder("Campanhas");
      await this.vault.createFolder(root);
      const created = new Set([root]);
      const folder = async (relative: string): Promise<void> => {
        let path = root;
        for (const segment of relative.split("/").filter(Boolean)) {
          path += `/${segment}`;
          if (!created.has(path)) { await this.vault.createFolder(path); created.add(path); }
        }
      };
      try {
        for (const name of ["Cenas", "Tokens", "Personagens", "Notas do mestre"]) await folder(name);
        for (const [path, data] of Object.entries(files)) {
          if (path === "campanha.yaml") continue;
          await folder(path.split("/").slice(0, -1).join("/"));
          await this.vault.createBinary(`${root}/${path}`, data.slice().buffer as ArrayBuffer);
        }
        // Manifesto por último: uma importação incompleta não vira campanha válida.
        await this.vault.create(`${root}/campanha.yaml`, stringifyYaml({ ...campaign, name: title }));
      } catch (error) {
        throw new Error(`Importação incompleta em ${root}. Arquivos preservados para recuperação. ${error instanceof Error ? error.message : ""}`);
      }
      return `${root}/campanha.yaml`;
    } };
  }
}
