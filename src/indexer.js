import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";

const markdownLinkPattern = /\[([^\]]+)\]\((?!https?:|mailto:|#)([^)]+)\)/g;
const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const mermaidFencePattern = /```(?:mermaid|mmd)\s*([\s\S]*?)```/gi;
const mermaidClickPattern = /^\s*click\s+\S+\s+"([^"]+)"/gim;

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function titleFromMarkdown(raw, fallback) {
  const match = raw.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return fallback
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveRelativeDoc(fromRelPath, target) {
  const cleanTarget = target.split("#")[0];
  if (!cleanTarget) return null;
  const dirname = path.posix.dirname(fromRelPath);
  return normalizePath(path.posix.normalize(path.posix.join(dirname, cleanTarget)));
}

function extractMarkdownLinks(raw, relPath) {
  const links = [];

  for (const match of raw.matchAll(markdownLinkPattern)) {
    links.push({
      type: "markdown-link",
      label: match[1],
      target: match[2],
      resolvedPath: resolveRelativeDoc(relPath, match[2])
    });
  }

  for (const match of raw.matchAll(wikiLinkPattern)) {
    links.push({
      type: "wiki-link",
      label: match[2] ?? match[1],
      target: match[1].trim()
    });
  }

  return links;
}

function extractMermaidClickLinks(raw) {
  const links = [];
  for (const fence of raw.matchAll(mermaidFencePattern)) {
    for (const click of fence[1].matchAll(mermaidClickPattern)) {
      links.push({
        type: "diagram-click",
        label: "diagram click",
        target: click[1]
      });
    }
  }
  return links;
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function extractExternalDiagramLinks(doc, docsRoot) {
  if (!doc.diagram) return [];
  const diagramPath = path.resolve(path.dirname(doc.absPath), doc.diagram);
  const raw = await readIfExists(diagramPath);
  if (!raw) return [];
  const links = [];
  for (const click of raw.matchAll(mermaidClickPattern)) {
    links.push({
      type: "diagram-click",
      label: "diagram click",
      target: click[1]
    });
  }
  return links;
}

function resolveTarget(link, docsById, docsByPath, docsByTitle) {
  if (link.resolvedPath && docsByPath.has(link.resolvedPath)) {
    return docsByPath.get(link.resolvedPath).id;
  }

  const target = String(link.target ?? "").replace(/^#\/doc\//, "").replace(/^doc:/, "");
  if (docsById.has(target)) return target;

  const pathTarget = target.split("#")[0];
  if (docsByPath.has(pathTarget)) return docsByPath.get(pathTarget).id;

  const titleKey = slugify(target);
  if (docsByTitle.has(titleKey)) return docsByTitle.get(titleKey).id;

  return null;
}

export async function buildIndex({ cwd, config }) {
  const docsRoot = path.resolve(cwd, config.docs.root);
  const entries = await fg(config.docs.include, {
    cwd: docsRoot,
    onlyFiles: true,
    dot: false,
    ignore: ["node_modules/**", ".git/**"]
  });

  const docs = [];
  for (const relPath of entries.sort()) {
    const absPath = path.join(docsRoot, relPath);
    const raw = await fs.readFile(absPath, "utf8");
    const parsed = matter(raw);
    const normalizedRelPath = normalizePath(relPath);
    const title = parsed.data.title || titleFromMarkdown(parsed.content, path.basename(relPath));
    const id = parsed.data.id || slugify(normalizedRelPath);

    docs.push({
      id,
      title,
      path: normalizedRelPath,
      folder: normalizePath(path.dirname(normalizedRelPath)),
      type: parsed.data.type || "doc",
      status: parsed.data.status || undefined,
      summary: parsed.data.summary || "",
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
      related: Array.isArray(parsed.data.related) ? parsed.data.related : [],
      diagram: parsed.data.diagram || undefined,
      absPath,
      linksOut: [
        ...(parsed.data.related?.map?.((target) => ({ type: "frontmatter", target })) ?? []),
        ...extractMarkdownLinks(parsed.content, normalizedRelPath),
        ...extractMermaidClickLinks(parsed.content)
      ]
    });
  }

  const docsById = new Map(docs.map((doc) => [doc.id, doc]));
  const docsByPath = new Map(docs.map((doc) => [doc.path, doc]));
  const docsByTitle = new Map(docs.map((doc) => [slugify(doc.title), doc]));

  for (const doc of docs) {
    doc.linksOut.push(...await extractExternalDiagramLinks(doc, docsRoot));
    doc.linksOut = doc.linksOut.map((link) => ({
      ...link,
      to: resolveTarget(link, docsById, docsByPath, docsByTitle)
    }));
  }

  const backlinks = new Map(docs.map((doc) => [doc.id, []]));
  const backlinkKeys = new Set();
  for (const doc of docs) {
    for (const link of doc.linksOut) {
      const key = `${doc.id}->${link.to}`;
      if (link.to && backlinks.has(link.to) && !backlinkKeys.has(key)) {
        backlinkKeys.add(key);
        backlinks.get(link.to).push({
          from: doc.id,
          fromTitle: doc.title,
          type: link.type,
          label: link.label ?? link.target
        });
      }
    }
  }

  return {
    docsRoot,
    docs: docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      path: doc.path,
      folder: doc.folder === "." ? "" : doc.folder,
      type: doc.type,
      status: doc.status,
      summary: doc.summary,
      tags: doc.tags,
      related: doc.related,
      diagram: doc.diagram,
      linksOut: doc.linksOut.map(({ type, target, to, label }) => ({ type, target, to, label })),
      backlinks: backlinks.get(doc.id) ?? []
    }))
  };
}
