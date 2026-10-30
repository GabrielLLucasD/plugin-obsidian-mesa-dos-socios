import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zipSync } from 'fflate';
import { readCampaignArchive, writeCampaignArchive, validateArchivePath } from '../src/infrastructure/campaign-archive.ts';

const encode = text => new TextEncoder().encode(text);
const manifest = encode('version: 1\nid: abc\nname: Mina\nscenes: []\n');
test('ZIP preserva manifesto, notas e imagens sem alterar bytes', () => {
  const files = { 'campanha.yaml': manifest, 'Notas do mestre/Segredo.md': encode('# Segredo'), 'Cenas/Mina/mapa.png': new Uint8Array([0, 255, 10, 100]) };
  const restored = readCampaignArchive(writeCampaignArchive(files));
  for (const [name, bytes] of Object.entries(files)) assert.deepEqual(restored[name], bytes);
});
test('recusa caminhos fora da campanha, arquivos ocultos e nomes não portáveis', () => {
  for (const path of ['../nota.md', '/nota.md', 'C:/nota.md', 'a\\b.md', '.obsidian/config', 'a/../../b', 'a//b', 'CON.txt', 'a./b', '__proto__/a']) {
    assert.throws(() => validateArchivePath(path));
    assert.throws(() => readCampaignArchive(zipSync({ 'campanha.yaml': manifest, [path]: encode('x') })));
  }
});
test('recusa nomes conflitantes, arquivos versus pastas e ausência de manifesto', () => {
  for (const extra of [{ 'A.md': encode('a'), 'a.md': encode('b') }, { 'Tokens': encode('a'), 'Tokens/a.png': encode('b') }]) {
    assert.throws(() => writeCampaignArchive({ 'campanha.yaml': manifest, ...extra }));
  }
  assert.throws(() => readCampaignArchive(zipSync({ 'outro.yaml': manifest })));
  assert.throws(() => readCampaignArchive(new Uint8Array([1, 2, 3])));
});
test('limita quantidade e tamanho declarado antes de descompactar', () => {
  const many = Object.fromEntries(Array.from({length: 1001}, (_, index) => [`${index}.md`, encode('')]));
  assert.throws(() => readCampaignArchive(zipSync(many)), /demais/);
  const bytes = zipSync({ 'campanha.yaml': manifest });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < bytes.length - 24; index++) {
    if (view.getUint32(index, true) === 0x02014b50) { view.setUint32(index + 24, 129 * 1024 * 1024, true); break; }
  }
  assert.throws(() => readCampaignArchive(bytes), /128 MiB/);
});
