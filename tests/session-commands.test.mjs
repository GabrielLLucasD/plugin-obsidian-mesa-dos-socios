import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const result = await build({ entryPoints: ['src/commands/session-commands.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['obsidian'] });
const notices = [];
const modals = [];
class Modal {
  constructor() { this.contentEl = { empty() {}, createEl() { return {}; } }; this.titleEl = { setText() {} }; modals.push(this); }
  open() { this.opened = true; }
  close() {
    if (!this.opened) throw new Error('Modal já fechado');
    this.opened = false;
    this.onClose();
  }
}
const module = { exports: {} };
const require = createRequire(import.meta.url);
new Function('require', 'module', 'exports', result.outputFiles[0].text)(
  (id) => id === 'obsidian' ? { Modal, Notice: class { constructor(message) { notices.push(message); } } } : require(id), module, module.exports,
);
function fixture() {
  notices.length = 0;
  modals.length = 0;
  const commands = new Map();
  let stops = 0;
  const registered = module.exports.registerSessionCommands({ app: {}, register() {}, addCommand(c) { commands.set(c.id, c.callback); return c; } },
    { async stop() { stops++; } }, () => true);
  return { commands, registered, stops: () => stops };
}
test('aba e paleta compartilham os mesmos comandos e o encerramento', async () => {
  const f = fixture();
  assert.equal(f.registered.create.callback, f.commands.get('criar-sessao'));
  assert.equal(f.registered.manage.callback, f.commands.get('gerenciar-sessao'));
  await f.registered.end.callback();
  assert.equal(f.stops(), 1);
  assert.match(notices.at(-1), /Sessão encerrada/);
});
test('encerrar após fechar manualmente os modais não tenta fechá-los novamente', async () => {
  const f = fixture();
  f.commands.get('criar-sessao')();
  modals.at(-1).close();
  f.commands.get('gerenciar-sessao')();
  modals.at(-1).close();
  await f.commands.get('encerrar-sessao')();
  assert.equal(f.stops(), 1);
  assert.match(notices.at(-1), /Sessão encerrada/);
});
test('falha ao fechar uma janela não impede parada e é informada ao usuário', async () => {
  const f = fixture();
  f.commands.get('gerenciar-sessao')();
  modals.at(-1).close = () => { throw new Error('Falha visual simulada'); };
  await f.commands.get('encerrar-sessao')();
  assert.equal(f.stops(), 1);
  assert.equal(notices.at(-1), 'Falha visual simulada');
});
