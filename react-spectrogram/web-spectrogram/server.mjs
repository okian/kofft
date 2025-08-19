import express from "express";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";

function createApp(staticDir) {
  const app = express();
  app.use((_, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    next();
  });
  app.use(express.static(staticDir));
  return app;
}

export function createServer(rootDir) {
  const dir = rootDir
    ? path.resolve(rootDir)
    : path.dirname(fileURLToPath(import.meta.url));
  const app = createApp(dir);
  const { private: key, cert } = selfsigned.generate();
  return https.createServer({ key, cert }, app);
}

export function main(port = process.env.PORT || 8443, rootDir) {
  const server = createServer(rootDir);
  server.listen(port, () => {
    console.log(`Serving on https://localhost:${port}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
