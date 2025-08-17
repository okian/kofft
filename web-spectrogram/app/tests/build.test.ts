import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { test, expect } from "vitest";

test("npm build outputs sw.js", () => {
  const root = path.resolve(__dirname, "..", "..");
  const appDir = path.join(root, "app");
  const distDir = path.join(appDir, "dist");
  const pkgDir = path.join(root, "pkg");
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  if (existsSync(pkgDir)) rmSync(pkgDir, { recursive: true, force: true });
  execSync("wasm-pack build --target web", { cwd: root, stdio: "inherit" });
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  expect(existsSync(path.join(appDir, "dist", "sw.js"))).toBe(true);
  rmSync(distDir, { recursive: true, force: true });
  rmSync(pkgDir, { recursive: true, force: true });
});
