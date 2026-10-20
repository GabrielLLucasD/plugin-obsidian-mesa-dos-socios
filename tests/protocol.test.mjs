import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClientMessage } from "../src/shared/protocol.ts";

import {
  isClientMessage,
  isServerMessage,
} from "../src/shared/protocol.ts";

test("aceita ping do cliente e pong do servidor", () => {
  assert.equal(
    isClientMessage({ type: "ping", requestId: "123" }),
    true,
  );

  assert.equal(
    isServerMessage({ type: "pong", requestId: "123" }),
    true,
  );
});

test("rejeita mensagens enviadas na direção errada", () => {
  assert.equal(
    isClientMessage({ type: "pong", requestId: "123" }),
    false,
  );

  assert.equal(
    isServerMessage({ type: "ping", requestId: "123" }),
    false,
  );
});

test("rejeita valores que não representam mensagens", () => {
  const invalidValues = [
    null,
    undefined,
    true,
    42,
    "ping",
    [],
    {},
    { requestId: "123" },
    { type: "desconhecido", requestId: "123" },
  ];

  for (const value of invalidValues) {
    assert.equal(isClientMessage(value), false);
    assert.equal(isServerMessage(value), false);
  }
});

test("rejeita identificadores inválidos nos dois sentidos", () => {
  const invalidIds = [
    undefined,
    null,
    123,
    "",
    "   ",
    "\t\n",
    "a".repeat(65),
  ];

  for (const requestId of invalidIds) {
    assert.equal(
      isClientMessage({ type: "ping", requestId }),
      false,
    );

    assert.equal(
      isServerMessage({ type: "pong", requestId }),
      false,
    );
  }
});

test("aceita identificadores nos limites permitidos", () => {
  for (const requestId of ["a", "a".repeat(64)]) {
    assert.equal(
      isClientMessage({ type: "ping", requestId }),
      true,
    );

    assert.equal(
      isServerMessage({ type: "pong", requestId }),
      true,
    );
  }
});

test("interpreta um ping válido", () => {
  const result = parseClientMessage(
    '{"type":"ping","requestId":"123"}',
  );

  assert.deepEqual(result, {
    ok: true,
    message: {
      type: "ping",
      requestId: "123",
    },
  });
});

test("identifica JSON malformado", () => {
  const result = parseClientMessage('{"type":');

  assert.deepEqual(result, {
    ok: false,
    reason: "invalid-json",
  });
});

test("identifica JSON válido que viola o protocolo", () => {
  const result = parseClientMessage(
    '{"type":"ping","requestId":42}',
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "invalid-message",
  });
});