import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export const defaultConfig = {
  docs: {
    root: "docs",
    include: ["**/*.md", "**/*.mdx"]
  },
  portless: {
    enabled: true,
    prefix: "docs",
    args: []
  },
  open: true
};

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    docs: {
      ...base.docs,
      ...(override.docs ?? {})
    },
    portless: {
      ...base.portless,
      ...(override.portless ?? {})
    }
  };
}

export function configPath(cwd) {
  return path.join(cwd, "docolab.yml");
}

export function loadConfig(cwd, docsRootOverride) {
  const file = configPath(cwd);
  const parsed = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, "utf8")) ?? {} : {};
  const config = mergeConfig(defaultConfig, parsed);

  if (docsRootOverride) {
    config.docs.root = docsRootOverride;
  }

  config.docs.root = String(config.docs.root || "docs");
  config.docs.include = Array.isArray(config.docs.include)
    ? config.docs.include
    : defaultConfig.docs.include;
  config.portless.enabled = config.portless.enabled !== false;
  config.portless.prefix = String(config.portless.prefix || config.portless.name || "docs");
  config.portless.args = Array.isArray(config.portless.args) ? config.portless.args : [];
  config.open = config.open !== false;

  return config;
}

export function defaultConfigText() {
  return YAML.stringify(defaultConfig);
}

export function writeDefaultConfig(cwd) {
  const file = configPath(cwd);
  if (fs.existsSync(file)) {
    throw new Error(`docolab.yml already exists at ${file}`);
  }
  fs.writeFileSync(file, defaultConfigText(), "utf8");
  return file;
}
