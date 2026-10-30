import { unzipSync, zipSync } from "fflate";

export const ARCHIVE_LIMITS = { files: 1000, bytes: 128 * 1024 * 1024 };
export type ArchiveFiles = Record<string, Uint8Array>;

export function validateArchivePath(path: string): void {
  const segments = path.split("/");
  if (!path || path.length > 240 || segments.some((part) => !part || part.startsWith(".") || ["__proto__", "constructor", "prototype"].includes(part) ||
    /[<>:"\\|?*\u0000-\u001f]/u.test(part) || /[. ]$/.test(part) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) {
    throw new Error(`Caminho inválido no pacote: ${path}`);
  }
}

export function validateArchiveFiles(files: ArchiveFiles): void {
  const names = Object.keys(files);
  if (!names.length || names.length > ARCHIVE_LIMITS.files) throw new Error("Quantidade de arquivos não suportada.");
  const seen = new Set<string>();
  let total = 0;
  for (const name of names) {
    validateArchivePath(name);
    const key = name.toLowerCase();
    if (seen.has(key)) throw new Error("Arquivos com nomes conflitantes no pacote.");
    seen.add(key);
    total += files[name]!.byteLength;
    if (total > ARCHIVE_LIMITS.bytes) throw new Error("Campanha excede 128 MiB.");
  }
  for (const key of seen) {
    const segments = key.split("/");
    segments.pop();
    while (segments.length) {
      if (seen.has(segments.join("/"))) throw new Error("Conflito entre arquivo e pasta no pacote.");
      segments.pop();
    }
  }
  if (!files["campanha.yaml"]) throw new Error("O ZIP precisa conter campanha.yaml na raiz.");
}

export function readCampaignArchive(bytes: Uint8Array): ArchiveFiles {
  if (bytes.byteLength > ARCHIVE_LIMITS.bytes) throw new Error("ZIP excede 128 MiB.");
  let total = 0;
  let count = 0;
  const seen = new Set<string>();
  const files = unzipSync(bytes, { filter: (entry) => {
    if (++count > ARCHIVE_LIMITS.files) throw new Error("Arquivos demais no ZIP.");
    const directory = entry.name.endsWith("/");
    validateArchivePath(directory ? entry.name.slice(0, -1) : entry.name);
    const key = entry.name.toLowerCase();
    if (seen.has(key)) throw new Error("Entradas duplicadas no ZIP.");
    seen.add(key);
    total += entry.originalSize;
    if (total > ARCHIVE_LIMITS.bytes) throw new Error("Conteúdo descompactado excede 128 MiB.");
    return !directory;
  } });
  validateArchiveFiles(files);
  return files;
}

export function writeCampaignArchive(files: ArchiveFiles): Uint8Array {
  validateArchiveFiles(files);
  return zipSync(files, { level: 0 });
}
