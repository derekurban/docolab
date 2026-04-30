import mermaid from "/vendor/mermaid/mermaid.esm.min.mjs";

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "neutral" });

let index = { docs: [] };
let activeId = "";

const nav = document.querySelector("#nav");
const docRoot = document.querySelector("#doc");
const contextRoot = document.querySelector("#context");
const search = document.querySelector("#search");

function byId(id) {
  return index.docs.find((doc) => doc.id === id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function getActiveId() {
  const match = location.hash.match(/^#\/doc\/(.+)$/);
  return match?.[1] || index.docs[0]?.id || "";
}

function folderGroups(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const folder = doc.folder || "root";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(doc);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function renderNav() {
  const term = search.value.trim().toLowerCase();
  const docs = index.docs.filter((doc) => {
    const haystack = `${doc.title} ${doc.summary} ${doc.path} ${doc.id}`.toLowerCase();
    return !term || haystack.includes(term);
  });

  nav.innerHTML = folderGroups(docs).map(([folder, folderDocs]) => `
    <section>
      <h3>${escapeHtml(folder)}</h3>
      ${folderDocs.map((doc) => `
        <a class="${doc.id === activeId ? "active" : ""}" href="#/doc/${escapeHtml(doc.id)}">
          <strong>${escapeHtml(doc.title)}</strong>
          <small>${escapeHtml(doc.type)} · ${escapeHtml(doc.path)}</small>
        </a>
      `).join("")}
    </section>
  `).join("");
}

async function renderMermaidBlocks() {
  const blocks = [...docRoot.querySelectorAll("pre code.language-mermaid, pre code.language-mmd")];
  for (const [index, block] of blocks.entries()) {
    const source = block.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "diagram";
    try {
      const { svg } = await mermaid.render(`embedded-${activeId}-${index}`, source);
      wrapper.innerHTML = svg;
    } catch (error) {
      wrapper.textContent = error instanceof Error ? error.message : String(error);
      wrapper.classList.add("error");
    }
    block.closest("pre").replaceWith(wrapper);
  }
}

async function renderExternalDiagram(doc) {
  if (!doc.diagram) return "";
  const response = await fetch(`/api/diagram?doc=${encodeURIComponent(doc.path)}&diagram=${encodeURIComponent(doc.diagram)}`);
  if (!response.ok) return `<div class="notice">Diagram unavailable: ${escapeHtml(doc.diagram)}</div>`;
  const payload = await response.json();
  try {
    const { svg } = await mermaid.render(`diagram-${doc.id.replace(/[^a-z0-9]/gi, "-")}`, payload.source);
    return `<div class="diagram">${svg}</div>`;
  } catch (error) {
    return `<div class="notice error">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
  }
}

function renderContext(doc) {
  const outgoing = doc.linksOut.filter((link) => link.to).map((link) => byId(link.to)).filter(Boolean);
  const broken = doc.linksOut.filter((link) => !link.to);

  contextRoot.innerHTML = `
    <div class="panel">
      <h2>Agent loop</h2>
      <p>Edit <code>${escapeHtml(doc.path)}</code>, keep diagrams and links consistent, then refresh or let your dev server reload.</p>
    </div>
    <div class="panel">
      <h2>Links out</h2>
      ${outgoing.length ? outgoing.map((target) => `<a href="#/doc/${escapeHtml(target.id)}">${escapeHtml(target.title)}</a>`).join("") : "<p>No resolved links.</p>"}
    </div>
    <div class="panel">
      <h2>Backlinks</h2>
      ${doc.backlinks.length ? doc.backlinks.map((link) => `<a href="#/doc/${escapeHtml(link.from)}">${escapeHtml(link.fromTitle)}</a>`).join("") : "<p>No backlinks yet.</p>"}
    </div>
    <div class="panel">
      <h2>Broken links</h2>
      ${broken.length ? broken.map((link) => `<p><code>${escapeHtml(link.type)}</code> ${escapeHtml(link.target)}</p>`).join("") : "<p>None.</p>"}
    </div>
  `;
}

async function renderDoc() {
  activeId = getActiveId();
  const doc = byId(activeId);
  if (!doc) {
    docRoot.innerHTML = "<h1>Document not found</h1>";
    return;
  }

  const response = await fetch(`/api/doc?path=${encodeURIComponent(doc.path)}`);
  const payload = await response.json();
  const externalDiagram = await renderExternalDiagram(doc);

  docRoot.innerHTML = `
    <header class="doc-header">
      <p>${escapeHtml(doc.folder || "root")} / ${escapeHtml(doc.type)}</p>
      <h1>${escapeHtml(doc.title)}</h1>
      ${doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>` : ""}
      <div class="meta">
        <code>${escapeHtml(doc.id)}</code>
        <code>${escapeHtml(doc.path)}</code>
      </div>
    </header>
    ${externalDiagram}
    <article>${payload.html}</article>
  `;

  await renderMermaidBlocks();
  renderContext(doc);
  renderNav();
}

async function boot() {
  const response = await fetch("/api/index");
  index = await response.json();
  activeId = getActiveId();
  renderNav();
  await renderDoc();
}

window.addEventListener("hashchange", renderDoc);
search.addEventListener("input", renderNav);
boot();
