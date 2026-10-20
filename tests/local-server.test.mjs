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

// Compilamos o servidor isoladamente para testá-lo sem abrir o Obsidian.
const directory = await mkdtemp(join(tmpdir(), "obsidian-vtt-test-"));
let LocalServer;
try {
  const result = await build({
    entryPoints: ["src/server/local-server.ts"],
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
  LocalServer = compiledModule.default.LocalServer;
  } finally {
  await rm(join(directory, "server.cjs"), { force: true });
  await rmdir(directory);
}

test("serve a página local, restringe rotas e métodos, encerra e reinicia", async () => {
  const server = new LocalServer();
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
  const host = new LocalServer();
  const guest = new LocalServer();
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
  const server = new LocalServer();
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
    const server = new LocalServer();
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

      const socket = new WebSocket(wsUrl, {
        origin: url,
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