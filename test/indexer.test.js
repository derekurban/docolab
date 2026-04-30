import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildIndex } from "../src/indexer.js";
import { defaultConfig } from "../src/config.js";

test("buildIndex resolves markdown links and backlinks", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docolab-"));
  const docs = path.join(dir, "docs");
  fs.mkdirSync(docs);
  fs.writeFileSync(path.join(docs, "a.md"), "---\nid: a\n---\n# A\nSee [B](./b.md).", "utf8");
  fs.writeFileSync(path.join(docs, "b.md"), "---\nid: b\n---\n# B\n", "utf8");

  const index = await buildIndex({ cwd: dir, config: defaultConfig });
  const a = index.docs.find((doc) => doc.id === "a");
  const b = index.docs.find((doc) => doc.id === "b");

  assert.equal(a.linksOut[0].to, "b");
  assert.equal(b.backlinks[0].from, "a");
});
