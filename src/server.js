import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import matter from "gray-matter";
import { loadConfig } from "./config.js";
import { buildIndex } from "./indexer.js";

const require = createRequire(import.meta.url);
const srcRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
const clientRoot = path.join(srcRoot, "web");
const mermaidRoot = path.join(path.dirname(require.resolve("mermaid/package.json")), "dist");

function sendJson(res, value) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendText(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(value);
}

function safeJoin(root, requestedPath) {
  const resolved = path.resolve(root, requestedPath);
  if (!resolved.startsWith(root)) {
    throw new Error("Path escapes root");
  }
  return resolved;
}

async function serveFile(res, root, requestedPath, contentType) {
  try {
    const file = safeJoin(root, requestedPath);
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function renderMarkdown(content) {
  return marked.parse(content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
    return `[${label || id}](#/doc/${id})`;
  }));
}

export async function startServer({ cwd, docsRoot, port = 0 }) {
  const config = loadConfig(cwd, docsRoot);
  let currentIndex = null;

  async function getIndex() {
    currentIndex = await buildIndex({ cwd, config });
    return currentIndex;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (url.pathname === "/") {
        await serveFile(res, clientRoot, "index.html", "text/html; charset=utf-8");
        return;
      }

      if (url.pathname === "/app.js") {
        await serveFile(res, clientRoot, "app.js", "application/javascript; charset=utf-8");
        return;
      }

      if (url.pathname === "/styles.css") {
        await serveFile(res, clientRoot, "styles.css", "text/css; charset=utf-8");
        return;
      }

      if (url.pathname.startsWith("/vendor/mermaid/")) {
        await serveFile(
          res,
          mermaidRoot,
          url.pathname.replace("/vendor/mermaid/", ""),
          "application/javascript; charset=utf-8"
        );
        return;
      }

      if (url.pathname === "/api/index") {
        sendJson(res, await getIndex());
        return;
      }

      if (url.pathname === "/api/doc") {
        const relPath = url.searchParams.get("path");
        if (!relPath) {
          sendText(res, 400, "Missing path");
          return;
        }
        const index = currentIndex ?? await getIndex();
        const absPath = safeJoin(index.docsRoot, relPath);
        const raw = await fs.readFile(absPath, "utf8");
        const parsed = matter(raw);
        sendJson(res, {
          frontmatter: parsed.data,
          raw: parsed.content,
          html: renderMarkdown(parsed.content)
        });
        return;
      }

      if (url.pathname === "/api/diagram") {
        const docPath = url.searchParams.get("doc");
        const diagram = url.searchParams.get("diagram");
        if (!docPath || !diagram) {
          sendText(res, 400, "Missing doc or diagram");
          return;
        }
        const index = currentIndex ?? await getIndex();
        const docAbsPath = safeJoin(index.docsRoot, docPath);
        const diagramAbsPath = safeJoin(path.dirname(docAbsPath), diagram);
        sendJson(res, { source: await fs.readFile(diagramAbsPath, "utf8") });
        return;
      }

      sendText(res, 404, "Not found");
    } catch (error) {
      sendText(res, 500, error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    port: typeof address === "object" && address ? address.port : port
  };
}
