import test from "node:test";
import assert from "node:assert/strict";
import { buildPortlessArgs } from "../src/cli.js";

test("buildPortlessArgs forces route takeover by default", () => {
  const args = buildPortlessArgs({
    name: "docs",
    cwd: "/repo",
    docsRoot: undefined,
    extraArgs: []
  });

  assert.deepEqual(args.slice(0, 3), ["docs", "--force", "node"]);
});

test("buildPortlessArgs preserves docs root and extra portless args", () => {
  const args = buildPortlessArgs({
    name: "docs",
    cwd: "/repo",
    docsRoot: "./product-docs",
    extraArgs: ["--tailscale"]
  });

  assert.equal(args.includes("--docs"), true);
  assert.equal(args.includes("./product-docs"), true);
  assert.equal(args.at(-1), "--tailscale");
});
