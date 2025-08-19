import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, main } from "./server.mjs";

async function run() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const root = path.dirname(fileURLToPath(import.meta.url));
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const res = await fetch(`https://localhost:${port}/app.mjs`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(res.headers.get("cross-origin-embedder-policy"), "require-corp");
  assert.equal(res.headers.get("cross-origin-resource-policy"), "same-origin");
  server.close();

  // Cover the main entry point as well
  const srv = main(0, root);
  await new Promise((resolve) => srv.once("listening", resolve));
  srv.close();
  console.log("server.mjs tests passed");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
