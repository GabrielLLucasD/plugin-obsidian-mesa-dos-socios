import assert from "node:assert/strict";
import { test } from "node:test";
import { Session } from "../src/domain/session.ts";
import { SessionService } from "../src/application/session-service.ts";

test("cria e mantém a sessão atual com a identidade injetada", () => {
  let calls = 0;
  const sessions = new SessionService(() => {
    calls++;
    return "sessao-1";
  });
  assert.equal(sessions.current, undefined);
  const session = sessions.create(4);
  assert.equal(session.id, "sessao-1");
  assert.equal(session.maxPlayers, 4);
  assert.equal(sessions.current, session);
  assert.equal(calls, 1);
});

test("rejeita capacidades inválidas no domínio e na aplicação", () => {
  let generated = 0;
  const sessions = new SessionService(() => String(++generated));
  const values = [undefined, null, "4", true, 0, -1, 1.5, NaN, Infinity,
    Number.MAX_SAFE_INTEGER + 1];
  for (const value of values) {
    assert.throws(() => new Session("sessao-1", value), /inteiro positivo/);
    assert.throws(() => sessions.create(value), /inteiro positivo/);
    assert.equal(sessions.current, undefined);
  }
  assert.equal(generated, 0);
  assert.equal(sessions.create(1).maxPlayers, 1);
});

test("não substitui a sessão nem gera nova identidade na criação duplicada", () => {
  let calls = 0;
  const sessions = new SessionService(() => String(++calls));
  const original = sessions.create(4);
  assert.throws(() => sessions.create(6), /Já existe uma sessão/);
  assert.equal(sessions.current, original);
  assert.equal(sessions.current.maxPlayers, 4);
  assert.equal(calls, 1);
});

test("rejeita identificadores inválidos sem publicar uma sessão", () => {
  for (const id of [undefined, null, 123, "", "   "]) {
    const sessions = new SessionService(() => id);
    assert.throws(() => sessions.create(4), /identificador/);
    assert.equal(sessions.current, undefined);
  }
});

test("falha do gerador não ocupa sessão e permite tentar novamente", () => {
  let fail = true;
  const sessions = new SessionService(() => {
    if (fail) throw new Error("Gerador indisponível");
    return "recuperada";
  });
  assert.throws(() => sessions.create(4), /Gerador indisponível/);
  assert.equal(sessions.current, undefined);
  fail = false;
  assert.equal(sessions.create(4).id, "recuperada");
});

test("consumidores não conseguem alterar a capacidade ou identidade", () => {
  const sessions = new SessionService(() => "sessao-1");
  const session = sessions.create(4);
  assert.throws(() => { session.maxPlayers = 0; }, TypeError);
  assert.throws(() => { session.id = "outra"; }, TypeError);
  assert.equal(sessions.current.maxPlayers, 4);
  assert.equal(sessions.current.id, "sessao-1");
});

test("instâncias distintas mantêm sessões independentes", () => {
  const first = new SessionService(() => "primeira");
  const second = new SessionService(() => "segunda");
  first.create(4);
  assert.equal(second.current, undefined);
  second.create(2);
  assert.equal(first.current.maxPlayers, 4);
  assert.equal(second.current.maxPlayers, 2);
});
