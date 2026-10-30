import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { writeCampaignArchive, readCampaignArchive } from '../src/infrastructure/campaign-archive.ts';

class TFile {
  constructor(path, data) { this.path = path; this.name = path.split('/').at(-1); this.parent = { path: path.split('/').slice(0,-1).join('/') }; this.data = data; this.stat = { size: data.length }; }
}
class TFolder { constructor(path) { this.path = path; } }
const compiled = await build({ entryPoints: ['src/infrastructure/vault-campaign-transfer.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['obsidian'] });
const module = { exports: {} };
const require = createRequire(import.meta.url);
// JSON é usado apenas como codec de teste; o runtime do plugin usa parseYaml/stringifyYaml.
new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(id => id === 'obsidian' ? { TFile, TFolder, parseYaml: JSON.parse, stringifyYaml: JSON.stringify } : require(id), module, module.exports);
const { VaultCampaignTransfer } = module.exports;
const encode = text => new TextEncoder().encode(text);
const manifest = encode(JSON.stringify({ version: 1, id: 'camp', name: 'Mina', scenes: [{ id: 'scene', name: 'Entrada' }] }));
function fixture() {
  const entries = new Map();
  const writes = [];
  const vault = {
    getAbstractFileByPath: path => entries.get(path),
    getFiles: () => [...entries.values()].filter(f => f instanceof TFile),
    read: async file => new TextDecoder().decode(file.data),
    readBinary: async file => file.data.slice().buffer,
    createFolder: async path => { if(entries.has(path)) throw new Error('existe'); entries.set(path, new TFolder(path)); writes.push(path); },
    createBinary: async (path, bytes) => { if(entries.has(path)) throw new Error('existe'); entries.set(path, new TFile(path, new Uint8Array(bytes))); writes.push(path); },
    create: async (path, text) => { if(entries.has(path)) throw new Error('existe'); entries.set(path, new TFile(path, encode(text))); writes.push(path); },
  };
  return { entries, writes, transfer: new VaultCampaignTransfer(vault) };
}
test('importa cópia completa, publica manifesto por último e exporta somente sua pasta', async () => {
  const { transfer, entries, writes } = fixture();
  const image = new Uint8Array([0, 32, 255]);
  const incoming = transfer.inspect(writeCampaignArchive({ 'campanha.yaml': manifest, 'Cenas/Entrada/mapa.png': image, 'Notas do mestre/Plano.md': encode('privado') }));
  const path = await incoming.restore('Mina importada');
  assert.equal(writes.at(-1), path);
  assert.deepEqual(entries.get('Campanhas/Mina importada/Cenas/Entrada/mapa.png').data, image);
  entries.set('Outra nota.md', new TFile('Outra nota.md', encode('fora')));
  const exported = readCampaignArchive(await transfer.export(path));
  assert.deepEqual(exported['Cenas/Entrada/mapa.png'], image);
  assert.ok(exported['Notas do mestre/Plano.md']);
  assert.equal(exported['Outra nota.md'], undefined);
  assert.equal(JSON.parse(new TextDecoder().decode(exported['campanha.yaml'])).name, 'Mina importada');
});
test('campanha inválida e pasta já existente não são sobrescritas', async () => {
  const { transfer, writes, entries } = fixture();
  assert.throws(() => transfer.inspect(writeCampaignArchive({ 'campanha.yaml': encode('{"version":99}') })));
  assert.equal(writes.length, 0);
  const incoming = transfer.inspect(writeCampaignArchive({ 'campanha.yaml': manifest }));
  entries.set('Campanhas/Mina', new TFolder('Campanhas/Mina'));
  await assert.rejects(incoming.restore('Mina'), /já existe/);
  await assert.rejects(incoming.restore('../fora'), /válido/);
  assert.equal(writes.length, 0);
});
