import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CampaignService, validateCampaign } from '../src/application/campaign-service.ts';

function fixture() {
  const files = new Map();
  let id = 0;
  const repository = {
    async create(campaign) {
      const doc = { path: `${campaign.id}/campanha.yaml`, source: String(++id), campaign: structuredClone(campaign) };
      files.set(doc.path, structuredClone(doc)); return doc;
    },
    async load(path) { if (!files.has(path)) throw new Error('não encontrado'); return structuredClone(files.get(path)); },
    async save(previous, campaign) {
      if (files.get(previous.path).source !== previous.source) throw new Error('conflito');
      const next = { path: previous.path, source: String(++id), campaign: structuredClone(campaign) };
      files.set(next.path, structuredClone(next)); return next;
    },
  };
  return { service: new CampaignService(repository, () => `id-${++id}`), repository, files };
}
test('cria, renomeia, remove e recupera cenas ao reabrir campanha', async () => {
  const { service, repository } = fixture();
  await service.create(' Mina ');
  await service.addScene('Entrada');
  await service.addScene('Salão');
  const first = service.current.campaign.scenes[0];
  await service.renameScene(first.id, 'Portão');
  assert.equal(service.current.campaign.scenes[0].id, first.id);
  const other = new CampaignService(repository, () => 'outro');
  await other.open(service.current.path);
  assert.equal(other.current.campaign.scenes[0].name, 'Portão');
  await service.removeScene(first.id);
  assert.deepEqual(service.current.campaign.scenes.map(s => s.name), ['Salão']);
});
test('falha de persistência e conflito preservam o estado publicado e a edição externa', async () => {
  const { service, files } = fixture();
  await service.create('Mina');
  const before = service.current;
  files.get(before.path).source = 'editado externamente';
  await assert.rejects(service.addScene('Entrada'), /conflito/);
  assert.deepEqual(service.current, before);
  assert.equal(files.get(before.path).source, 'editado externamente');
  await service.open(before.path);
  await service.addScene('Entrada');
  assert.equal(service.current.campaign.scenes.length, 1);
});
test('validação rejeita nomes, formatos futuros, campos desconhecidos e identidades repetidas', async () => {
  const { service } = fixture();
  await assert.rejects(service.create('  '));
  await assert.rejects(service.addScene('Entrada'), /Abra/);
  const base = { version: 1, id: 'c', name: 'Mina', scenes: [] };
  assert.throws(() => validateCampaign({ ...base, version: 2 }));
  assert.throws(() => validateCampaign({ ...base, extra: true }));
  assert.throws(() => validateCampaign({ ...base, scenes: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }));
  await service.create('Mina');
  const snapshot = service.current;
  snapshot.campaign.scenes.push({ id: 'evil', name: 'Alterado' });
  assert.equal(service.current.campaign.scenes.length, 0);
  await assert.rejects(service.removeScene('inexistente'));
});
test('operações concorrentes não sobrescrevem alterações', async () => {
  const { service } = fixture();
  await service.create('Mina');
  const results = await Promise.allSettled([service.addScene('A'), service.addScene('B')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(service.current.campaign.scenes.length, 1);
  await service.addScene('B');
  assert.equal(service.current.campaign.scenes.length, 2);
});
