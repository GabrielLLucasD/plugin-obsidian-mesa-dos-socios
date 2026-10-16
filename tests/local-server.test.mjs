import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Compilamos o servidor isoladamente para testá-lo sem abrir o Obsidian.
const directory = await mkdtemp(join(tmpdir(), "obsidian-vtt-test-"));
let LocalServer;
try {
  const result = await build({
    entryPoints: ["src/server/local-server.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const file = join(directory, "server.mjs");
  await writeFile(file, result.outputFiles[0].contents);
  ({ LocalServer } = await import(pathToFileURL(file).href));
} finally {
  await rm(join(directory, "server.mjs"), { force: true });
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
