import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, writeDefaultConfig } from "../src/config.js";

test("loadConfig returns defaults without docolab.yml", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docolab-"));
  const config = loadConfig(dir);
  assert.equal(config.docs.root, "docs");
  assert.equal(config.portless.prefix, "docs");
  assert.equal(config.portless.enabled, true);
});

test("writeDefaultConfig creates docolab.yml", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docolab-"));
  const file = writeDefaultConfig(dir);
  assert.equal(path.basename(file), "docolab.yml");
  assert.equal(fs.existsSync(file), true);
});
