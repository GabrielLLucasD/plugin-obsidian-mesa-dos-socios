import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { once } from "node:events";
import { WebSocket } from "ws";
import { clientAssetsPlugin } from "../build/client-assets.mjs";
import { get } from "node:http";

// Compilamos o servidor isoladamente para testá-lo sem abrir o Obsidian.
const directory = await mkdtemp(join(tmpdir(), "obsidian-vtt-test-"));
let LocalServer, createTestAccess;
try {
  const result = await build({
    entryPoints: ["tests/helpers/server-entry.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    loader: {
      ".html": "text",
    },
    plugins: [clientAssetsPlugin()],
  });
  const file = join(directory, "server.cjs");
  await writeFile(file, result.outputFiles[0].contents);
  const compiledModule = await import(pathToFileURL(file).href);
  ({ LocalServer, createTestAccess } = compiledModule.default);
  } finally {
  await rm(join(directory, "server.cjs"), { force: true });
  await rmdir(directory);
}

test("serve a página local, restringe rotas e métodos, encerra e reinicia", async () => {
  const server = new LocalServer(createTestAccess());
  try {
    const [url, repeated] = await Promise.all([server.start(0), server.start(0)]);
    assert.equal(url, repeated);
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(await page.text(), /Sua mesa está no ar/);
    assert.equal((await fetch(`${url}/minha-nota.md`)).status, 404);
    assert.equal((await fetch(`${url}/.obsidian/config`)).status, 404);
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal(await (await fetch(url, { method: "HEAD" })).text(), "");
    await Promise.all([server.stop(), server.stop()]);
    await assert.rejects(fetch(url, { signal: AbortSignal.timeout(2000) }),
      (error) => ["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(error.cause?.code));
    const restarted = await server.start(Number(new URL(url).port));
    assert.equal((await fetch(restarted)).status, 200);
    const script = await fetch(`${url}/client.js`);

assert.equal(script.status, 200);
assert.match(
  script.headers.get("content-type"),
  /text\/javascript/,
);
assert.ok((await script.text()).length > 0);
  } finally {
    await server.stop();
  }
});

test("explica porta ocupada e permite tentar novamente após a liberação", async () => {
  const host = new LocalServer(createTestAccess());
  const guest = new LocalServer(createTestAccess());
  try {
    const url = await host.start(0);
    const port = Number(new URL(url).port);
    await assert.rejects(guest.start(port), /porta .* ocupada/);
    await host.stop();
    assert.equal(await guest.start(port), url);
  } finally {
    await Promise.all([host.stop(), guest.stop()]);
  }
});

test("parar durante a inicialização libera a porta", async () => {
  const server = new LocalServer(createTestAccess());
  try {
    const starting = server.start(0);
    const stopping = server.stop();
    const url = await starting;
    await stopping;
    await assert.rejects(fetch(url, { signal: AbortSignal.timeout(2000) }),
      (error) => ["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes(error.cause?.code));
    assert.equal(await server.start(Number(new URL(url).port)), url);
  } finally {
    await server.stop();
  }
});

test(
  "responde ping, rejeita JSON inválido e reinicia o WebSocket",
  { timeout: 10000 },
  async (t) => {
    const access = createTestAccess();
    const server = new LocalServer(access);
    const sockets = [];

    t.after(async () => {
      for (const socket of sockets) {
        socket.terminate();
      }

      await server.stop();
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      const url = await server.start(0);
      const wsUrl = url.replace("http:", "ws:") + "/ws";
      let player = access.listPlayers()[0];
      let ticket;
      if (!player) {
        const pending = access.requestJoin(access.invite, "Ana");
        ticket = pending.ticket;
        player = access.approve(pending.request.id);
      } else {
        access.removePlayer(player.id);
        const pending = access.requestJoin(access.invite, "Ana");
        ticket = pending.ticket;
        access.approve(pending.request.id);
      }
      const token = access.claim(ticket).token;
      const headers = { Cookie: `vtt_${new URL(url).port}_session=${token}` };

      const socket = new WebSocket(wsUrl, {
        origin: url,
        headers,
      });

      sockets.push(socket);
      await once(socket, "open");

      const reply = once(socket, "message");

      socket.send(JSON.stringify({
        type: "ping",
        requestId: "teste-123",
      }));

      const [data] = await reply;

      assert.deepEqual(JSON.parse(data.toString()), {
        type: "pong",
        requestId: "teste-123",
      });

      const invalidClient = new WebSocket(wsUrl, {
        origin: url,
        headers,
      });

      sockets.push(invalidClient);
      await once(invalidClient, "open");

      const rejected = once(invalidClient, "close");
      invalidClient.send('{"type":');

      const [code] = await rejected;
      assert.equal(code, 1008);

      // O cliente válido continua conectado até pararmos o servidor.
      const disconnected = once(socket, "close");

      await server.stop();
      await disconnected;

      assert.equal(socket.readyState, WebSocket.CLOSED);
    }
  },
);

function browserClient(url) {
  const cookies = new Map();
  return {
    cookies,
    cookieHeader: () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
    async request(path, body, extra = {}) {
      const response = await fetch(`${url}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Origin: url,
          Cookie: this.cookieHeader(),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(3000),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0];
        const index = pair.indexOf('=');
        cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
  };
}

function rejectedUpgrade(url, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', {
      origin: url, handshakeTimeout: 2000, ...options,
    });
    socket.on('error', () => {});
    socket.on('open', () => { socket.terminate(); reject(new Error('A conexão deveria ser rejeitada.')); });
    socket.on('unexpected-response', (_request, response) => {
      response.resume();
      socket.terminate();
      resolve(response.statusCode);
    });
    socket.on('error', reject);
  });
}

async function approvedBrowser(url, access, name = 'Ana') {
  const client = browserClient(url);
  const pending = await client.request('/api/join-requests', { invite: access.invite, displayName: name });
  assert.equal(pending.status, 202);
  access.approve(pending.body.id);
  const claim = await client.request('/api/claim', {});
  assert.equal(claim.status, 200);
  return { client, playerId: claim.body.player.id };
}

test('HTTP: convite, espera, aprovação, cookie, reconexão, logout e isolamento', { timeout: 10000 }, async (t) => {
  const access = createTestAccess(1);
  const server = new LocalServer(access);
  t.after(() => server.stop());
  const url = await server.start(0);
  const browser = browserClient(url);
  const outsider = browserClient(url);
  assert.equal((await browser.request('/api/me')).status, 401);
  assert.equal((await browser.request('/api/session')).body.approvedPlayers, 0);
  assert.equal(await rejectedUpgrade(url), 401);
  assert.equal((await browser.request('/api/join-requests', { invite: 'invalid', displayName: 'Ana' })).status, 403);
  assert.equal((await browser.request('/api/join-requests', { invite: access.invite, displayName: 'Ana' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await browser.request('/api/join-requests', { invite: access.invite, displayName: 'Ana', role: 'host' })).status, 400);
  const pending = await browser.request('/api/join-requests', { invite: access.invite, displayName: 'Ana' });
  assert.equal(pending.status, 202);
  assert.match(pending.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await outsider.request('/api/join-request')).status, 410);
  assert.equal((await browser.request('/api/claim', {})).status, 403);
  access.approve(pending.body.id);
  assert.equal((await browser.request('/api/join-request')).body.status, 'approved');
  const claimed = await browser.request('/api/claim', {});
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.player.displayName, 'Ana');
  assert.equal(claimed.body.token, undefined);
  assert.equal(claimed.body.room.approvedPlayers, 1);
  const initialCookie = browser.cookieHeader();
  assert.equal((await browser.request('/api/claim', {})).status, 200);
  assert.equal(browser.cookieHeader(), initialCookie);
  assert.equal((await browser.request('/api/me')).body.player.id, claimed.body.player.id);
  const wsOptions = { origin: url, headers: { Cookie: browser.cookieHeader() } };
  assert.equal(await rejectedUpgrade(url, { ...wsOptions, origin: 'https://evil.example' }), 403);
  const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', wsOptions);
  t.after(() => socket.terminate());
  await once(socket, 'open');
  const reply = once(socket, 'message');
  socket.send(JSON.stringify({ type: 'ping', requestId: 'auth' }));
  assert.deepEqual(JSON.parse((await reply)[0].toString()), { type: 'pong', requestId: 'auth' });
  const closed = once(socket, 'close');
  assert.equal((await browser.request('/api/logout', {})).status, 200);
  await closed;
  assert.equal((await browser.request('/api/me')).status, 401);
  assert.equal(access.room.approvedPlayers, 1);
  assert.equal(await rejectedUpgrade(url, wsOptions), 401);
  assert.equal((await outsider.request('/api/admin/approve', {})).status, 404);
});

test('remover participante derruba todas as abas e impede recuperar pelo ticket', { timeout: 10000 }, async (t) => {
  const access = createTestAccess();
  const server = new LocalServer(access);
  t.after(() => server.stop());
  const url = await server.start(0);
  const { client, playerId } = await approvedBrowser(url, access);
  const sockets = [];
  t.after(() => sockets.forEach((socket) => socket.terminate()));
  for (let i = 0; i < 2; i++) {
    const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', { origin: url, headers: { Cookie: client.cookieHeader() } });
    sockets.push(socket);
    await once(socket, 'open');
  }
  assert.equal(access.room.approvedPlayers, 1);
  const closed = sockets.map((socket) => once(socket, 'close'));
  access.removePlayer(playerId);
  await Promise.all(closed);
  assert.equal(access.room.approvedPlayers, 0);
  assert.equal((await client.request('/api/me')).status, 401);
  assert.equal((await client.request('/api/claim', {})).status, 403);
});

test('API rejeita Host, formato e tamanho inválidos e limita tentativas', { timeout: 10000 }, async (t) => {
  const access = createTestAccess();
  const server = new LocalServer(access);
  t.after(() => server.stop());
  const url = await server.start(0);
  const invalidHost = await new Promise((resolve, reject) => {
    get(url, { headers: { Host: 'evil.example' } }, (response) => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(invalidHost, 403);
  const raw = async (body, type = 'application/json') => fetch(`${url}/api/join-requests`, {
    method: 'POST', headers: { Origin: url, 'Content-Type': type }, body,
  });
  assert.equal((await raw('{')).status, 400);
  assert.equal((await raw('{}', 'text/plain')).status, 415);
  assert.equal((await raw(JSON.stringify({ invite: 'x'.repeat(5000) }))).status, 413);
  const client = browserClient(url);
  for (let i = 0; i < 20; i++) {
    assert.equal((await client.request('/api/join-requests', { invite: 'invalid', displayName: 'A' })).status, 403);
  }
  const limited = await client.request('/api/join-requests', { invite: 'invalid', displayName: 'A' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
});

test('WebSocket limita abas por identidade e tamanho das mensagens', { timeout: 10000 }, async (t) => {
  const access = createTestAccess();
  const server = new LocalServer(access);
  t.after(() => server.stop());
  const url = await server.start(0);
  const { client } = await approvedBrowser(url, access);
  const options = { origin: url, headers: { Cookie: client.cookieHeader() } };
  const sockets = [];
  t.after(() => sockets.forEach((socket) => socket.terminate()));
  for (let i = 0; i < 4; i++) {
    const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', options);
    sockets.push(socket);
    await once(socket, 'open');
  }
  assert.equal(await rejectedUpgrade(url, options), 429);
  const closed = once(sockets[0], 'close');
  sockets[0].send('x'.repeat(5000));
  assert.equal((await closed)[0], 1009);
  assert.equal(access.room.approvedPlayers, 1);
});

test('hospedagem independe dos timers globais de navegador do Electron', { timeout: 5000 }, async () => {
  const original = globalThis.setInterval;
  const server = new LocalServer(createTestAccess());
  try {
    // No renderer, o timer global devolve número, sem unref().
    globalThis.setInterval = () => 123;
    const url = await server.start(0);
    assert.match(url, /127\.0\.0\.1/);
    await server.stop();
  } finally {
    globalThis.setInterval = original;
    await server.stop();
  }
});
