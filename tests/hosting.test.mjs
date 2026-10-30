import assert from "node:assert/strict";
import { test } from "node:test";
import { HostingService } from "../src/application/hosting-service.ts";
import { SessionService } from "../src/application/session-service.ts";
import { RoomAccess } from "../src/application/room-access.ts";
import { roomFixture, admit } from "./helpers/access.mjs";

function hostingFixture(factory) {
  const { dependencies } = roomFixture();
  const sessions = new SessionService(dependencies.newId);
  return new HostingService(sessions, (session) => new RoomAccess(session, dependencies), factory);
}

test("hospeda, revoga ao parar e permite criar uma nova sala", async () => {
  let stops = 0;
  const hosting = hostingFixture(() => ({ start: async () => "http://127.0.0.1:3210", stop: async () => { stops++; } }));
  const session = await hosting.create(4);
  const previousAccess = hosting.access;
  const player = admit(previousAccess);
  assert.equal(hosting.current.id, session.id);
  await assert.rejects(hosting.create(4), /andamento/);
  await Promise.all([hosting.stop(), hosting.stop()]);
  assert.equal(stops, 1);
  assert.equal(hosting.current, undefined);
  assert.throws(() => previousAccess.authenticate(player.token), /encerrada/);
  const next = await hosting.create(2);
  assert.notEqual(next.id, session.id);
  assert.throws(() => hosting.access.authenticate(player.token), /inválido/);
  await hosting.stop();
});

test("falha de abertura faz rollback e permite nova tentativa", async () => {
  let fail = true;
  const hosting = hostingFixture(() => ({
    start: async () => { if (fail) throw new Error("Porta ocupada"); return "ok"; },
    stop: async () => {},
  }));
  await assert.rejects(hosting.create(2), /Porta ocupada/);
  assert.equal(hosting.current, undefined);
  fail = false;
  await hosting.create(2);
  await hosting.stop();
});

test("parar durante a abertura cancela hospedagem e limpa recursos", async () => {
  let resolveStart;
  let stops = 0;
  const hosting = hostingFixture(() => ({
    start: () => new Promise((resolve) => { resolveStart = resolve; }),
    stop: async () => { stops++; },
  }));
  const opening = hosting.create(2);
  const rejected = assert.rejects(opening, /cancelada/);
  await Promise.resolve();
  const closing = hosting.stop();
  resolveStart("ok");
  await rejected;
  await closing;
  assert.equal(hosting.current, undefined);
  assert.equal(stops, 1);
});

test("capacidade inválida não cria transporte", async () => {
  let calls = 0;
  const hosting = hostingFixture(() => { calls++; throw new Error("não deveria executar"); });
  await assert.rejects(hosting.create(0), /inteiro positivo/);
  assert.equal(calls, 0);
  assert.equal(hosting.current, undefined);
});
