import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { loadConfig, writeDefaultConfig } from "./config.js";
import { startServer } from "./server.js";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPath = path.join(packageRoot, "bin", "docolab.js");

function printHelp() {
  console.log(`docolab

Usage:
  docolab init             Create docolab.yml in the current directory
  docolab dev [docsRoot]   Start the local docs harness
  docolab serve            Internal server command used by portless
  docolab help             Show this help

Examples:
  docolab init
  docolab dev
  docolab dev ./docs
`);
}

function getFlagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function withoutFlags(args) {
  const result = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      if (args[i + 1] && !args[i + 1].startsWith("--")) i += 1;
      continue;
    }
    result.push(args[i]);
  }
  return result;
}

function resolvePortlessCli() {
  const binName = process.platform === "win32" ? "portless.cmd" : "portless";
  let dir = packageRoot;

  for (let i = 0; i < 8; i += 1) {
    const candidates = [
      path.join(dir, "node_modules", ".bin", binName),
      path.join(dir, ".bin", binName)
    ];

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (found) return found;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error("Could not find the portless executable. Reinstall docolab and try again.");
}

export function buildPortlessArgs({ name, cwd, docsRoot, extraArgs }) {
  const args = [
    name,
    "--force",
    "node",
    cliPath,
    "serve",
    "--cwd",
    cwd
  ];

  if (docsRoot) args.push("--docs", docsRoot);
  args.push(...extraArgs);
  return args;
}

async function runDev(args) {
  const cwd = path.resolve(getFlagValue(args, "--cwd") ?? process.cwd());
  const positional = withoutFlags(args);
  const docsRoot = positional[1];
  const config = loadConfig(cwd, docsRoot);

  if (config.portless.enabled) {
    const name = config.portless.prefix;
    const url = `https://${name}.localhost`;
    const portlessCli = resolvePortlessCli();
    const childArgs = buildPortlessArgs({
      name,
      cwd,
      docsRoot,
      extraArgs: config.portless.args
    });

    console.log(`Starting docolab at ${url}`);
    const child = spawn(portlessCli, childArgs, {
      cwd,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32"
    });

    if (config.open) {
      setTimeout(() => {
        open(url).catch(() => {});
      }, 1200);
    }

    await new Promise((resolve) => {
      child.on("exit", (code) => {
        process.exitCode = code ?? 0;
        resolve();
      });
    });
    return;
  }

  const server = await startServer({ cwd, docsRoot });
  const url = `http://127.0.0.1:${server.port}`;
  console.log(`Starting docolab at ${url}`);
  if (config.open) await open(url).catch(() => {});
}

async function runServe(args) {
  const cwd = path.resolve(getFlagValue(args, "--cwd") ?? process.cwd());
  const docsRoot = getFlagValue(args, "--docs");
  const port = Number(process.env.PORT || getFlagValue(args, "--port") || 0);
  const server = await startServer({ cwd, docsRoot, port });
  console.log(`docolab server listening on ${server.port}`);
}

export async function main(args) {
  const command = args[0] ?? "help";

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    const cwd = path.resolve(getFlagValue(args, "--cwd") ?? process.cwd());
    const filePath = writeDefaultConfig(cwd);
    console.log(`Created ${filePath}`);
    return;
  }

  if (command === "dev") {
    await runDev(args);
    return;
  }

  if (command === "serve") {
    await runServe(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}
