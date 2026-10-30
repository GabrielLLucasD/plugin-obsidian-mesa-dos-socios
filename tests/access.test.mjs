import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCESS_POLICY } from "../src/application/room-access.ts";
import { roomFixture, admit } from "./helpers/access.mjs";

const code = (expected) => (error) => error.code === expected;

test("convite e aprovação são obrigatórios; identificadores não autenticam", () => {
  const { access } = roomFixture();
  assert.throws(() => access.requestJoin("errado", "Ana"), code("INVALID_INVITE"));
  for (const name of ["", " ", "x".repeat(41), "a\nb", 123]) {
    assert.throws(() => access.requestJoin(access.invite, name), code("INVALID_NAME"));
  }
  const request = access.requestJoin(access.invite, " Ana ");
  assert.equal(request.request.displayName, "Ana");
  assert.throws(() => access.claim(request.ticket), code("NOT_APPROVED"));
  const player = access.approve(request.request.id);
  for (const token of [access.session.id, player.id, request.ticket, request.request.id, "Ana"]) {
    assert.throws(() => access.authenticate(token), code("UNAUTHENTICATED"));
  }
  assert.equal(access.claim(request.ticket).me.player.id, player.id);
});

test("duas aprovações concorrentes não ultrapassam a última vaga", async () => {
  const { access } = roomFixture(1);
  const a = access.requestJoin(access.invite, "A");
  const b = access.requestJoin(access.invite, "B");
  const results = await Promise.allSettled([a, b].map((request) =>
    Promise.resolve().then(() => access.approve(request.request.id))));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "ROOM_FULL");
  assert.equal(access.room.approvedPlayers, 1);
});

test("repetir pedido usa o ticket, decisões são únicas e snapshots não mudam estado", () => {
  const { access } = roomFixture();
  const a = access.requestJoin(access.invite, "Ana");
  const again = access.requestJoin(access.invite, "Outro nome", a.ticket);
  assert.equal(again.request.id, a.request.id);
  again.request.displayName = "alterado";
  assert.equal(access.requestStatus(a.ticket).displayName, "Ana");
  const player = access.approve(a.request.id);
  player.displayName = "alterado";
  assert.equal(access.listPlayers()[0].displayName, "Ana");
  assert.throws(() => access.approve(a.request.id), code("REQUEST_NOT_PENDING"));
  assert.throws(() => access.reject(a.request.id), code("REQUEST_NOT_PENDING"));
});

test("rejeição e expiração impedem claim; pedidos não ocupam vaga", () => {
  const { access, advance } = roomFixture();
  const a = access.requestJoin(access.invite, "Ana");
  access.reject(a.request.id);
  assert.equal(access.requestStatus(a.ticket).status, "rejected");
  assert.throws(() => access.claim(a.ticket), code("NOT_APPROVED"));
  assert.equal(access.room.approvedPlayers, 0);
  advance(ACCESS_POLICY.requestTtlMs);
  assert.throws(() => access.requestStatus(a.ticket), code("REQUEST_EXPIRED"));
  assert.throws(() => access.approve(a.request.id), code("REQUEST_EXPIRED"));
});

test("reconectar mantém identidade, expirar preserva vaga e remover libera", () => {
  const { access, advance } = roomFixture(1);
  const a = admit(access);
  assert.equal(access.authenticate(a.token).player.id, a.player.id);
  assert.equal(access.authenticate(a.token).player.id, a.player.id);
  assert.equal(access.room.approvedPlayers, 1);
  advance(ACCESS_POLICY.credentialTtlMs);
  access.prune();
  assert.throws(() => access.authenticate(a.token), code("UNAUTHENTICATED"));
  assert.equal(access.room.approvedPlayers, 1);
  access.removePlayer(a.player.id);
  assert.equal(access.room.approvedPlayers, 0);
  assert.ok(admit(access, "B").token);
});

test("claim novamente gira credencial; logout revoga também o ticket", () => {
  const { access } = roomFixture();
  const a = admit(access);
  const replacement = access.claim(a.ticket);
  assert.throws(() => access.authenticate(a.token), code("UNAUTHENTICATED"));
  assert.equal(replacement.me.player.id, a.player.id);
  access.logout(replacement.token);
  assert.throws(() => access.authenticate(replacement.token), code("UNAUTHENTICATED"));
  assert.throws(() => access.claim(a.ticket), code("NOT_APPROVED"));
  assert.equal(access.room.approvedPlayers, 1);
});

test("remoção e encerramento revogam acessos e notificam consumidores", () => {
  const { access } = roomFixture();
  const a = admit(access);
  let events = 0;
  const unsubscribe = access.subscribeAccessChanges(() => { events++; });
  access.removePlayer(a.player.id);
  assert.equal(events, 1);
  assert.throws(() => access.authenticate(a.token), code("UNAUTHENTICATED"));
  assert.throws(() => access.claim(a.ticket), code("NOT_APPROVED"));
  const b = admit(access);
  access.close();
  assert.throws(() => access.authenticate(b.token), code("ROOM_CLOSED"));
  assert.throws(() => access.requestJoin("qualquer", "A"), code("ROOM_CLOSED"));
  unsubscribe(); access.close();
});

test("convite pode girar e novas solicitações podem ser bloqueadas", () => {
  const { access } = roomFixture();
  const old = access.invite;
  access.rotateInvite();
  assert.throws(() => access.requestJoin(old, "Ana"), code("INVALID_INVITE"));
  const pending = access.requestJoin(access.invite, "Ana");
  access.setAccepting(false);
  assert.throws(() => access.requestJoin(access.invite, "B"), code("ENTRY_CLOSED"));
  access.approve(pending.request.id);
  assert.ok(access.claim(pending.ticket).token);
});

test("fila tem limite e solicitações expiradas liberam espaço", () => {
  const { access, advance } = roomFixture();
  for (let i = 0; i < ACCESS_POLICY.maxRequests; i++) access.requestJoin(access.invite, `Pessoa ${i}`);
  assert.throws(() => access.requestJoin(access.invite, "Excesso"), code("TOO_MANY_REQUESTS"));
  advance(ACCESS_POLICY.requestTtlMs);
  assert.ok(access.requestJoin(access.invite, "Nova"));
});

test("falha de geração não consome vaga nem troca uma credencial válida", () => {
  const { access, dependencies } = roomFixture();
  const a = access.requestJoin(access.invite, "A");
  const originalId = dependencies.newId;
  dependencies.newId = () => { throw new Error("falha"); };
  assert.throws(() => access.approve(a.request.id), /falha/);
  assert.equal(access.room.approvedPlayers, 0);
  dependencies.newId = originalId;
  access.approve(a.request.id);
  const credential = access.claim(a.ticket);
  dependencies.newSecret = () => { throw new Error("falha"); };
  assert.throws(() => access.claim(a.ticket), /falha/);
  assert.ok(access.authenticate(credential.token));
});

test('convite curto aceita digitação flexível sem substituir credenciais de acesso', () => {
  const { access } = roomFixture();
  assert.match(access.invite, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const typed = `  ${access.invite.toLowerCase().replace('-', ' ')}  `;
  const request = access.requestJoin(typed, 'Ana');
  assert.throws(() => access.authenticate(access.invite), code('UNAUTHENTICATED'));
  assert.throws(() => access.claim(request.ticket), code('NOT_APPROVED'));
  access.approve(request.request.id);
  assert.equal(access.claim(request.ticket).token.length, 43);
  assert.equal(request.ticket.length, 43);
});
