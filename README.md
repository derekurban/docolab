# Docolab

Docolab is a local docs harness for Markdown, Mermaid diagrams, links, backlinks, and AI-assisted documentation loops.

Point it at a docs folder and it builds a wiki-style interface with folder navigation, rendered documents, diagrams, links out, backlinks, and broken-link hints.

## Install

```sh
npm install -g docolab
```

## Quick Start

From the root of a project with a `docs` folder:

```sh
docolab dev
```

Docolab starts a local server through [portless](https://github.com/vercel-labs/portless), opens your browser, and serves the docs at:

```text
https://docs.localhost
```

To use a different docs folder:

```sh
docolab dev ./product-docs
```

## Setup

Create a config file:

```sh
docolab init
```

This writes `docolab.yml`:

```yaml
docs:
  root: docs
  include:
    - "**/*.md"
    - "**/*.mdx"

portless:
  enabled: true
  prefix: docs
  args: []

open: true
```

Change `portless.prefix` to choose the stable local hostname:

```yaml
portless:
  prefix: product
```

Then:

```sh
docolab dev
# https://product.localhost
```

## What Docolab Understands

Docolab works with plain Markdown by default. Frontmatter is optional.

```md
---
id: auth.login-oauth
title: OAuth Login
type: user-flow
status: draft
summary: Native OAuth sign-in and bootstrap routing.
diagram: ./diagrams/login-oauth.mmd
related:
  - auth.token-refresh
---

# OAuth Login

See [Token Refresh](./token-refresh.md) and [[auth.link-phone]].
```

Supported relationship sources:

- Markdown links like `[Token Refresh](./token-refresh.md)`
- Wiki links like `[[auth.link-phone]]`
- Frontmatter `related`
- Frontmatter `diagram`
- Mermaid `click` links in embedded Mermaid blocks or external `.mmd` files

## AI Editing Loop

The intended workflow is file-based:

1. Run `docolab dev`.
2. Ask an agent to update a focused Markdown file.
3. Ask it to keep linked Mermaid diagrams and references consistent.
4. Inspect the live harness.
5. Continue the conversation.

No `AGENTS.md` or `CLAUDE.md` is required. If your project has either file, agents can use it as additional local context for documentation conventions.

## Publishing

This repository is configured for npm trusted publishing via GitHub Actions.

The publish workflow is `.github/workflows/publish.yml` and runs on tags matching `v*`.

On npmjs.com, configure the package trusted publisher with:

- Provider: GitHub Actions
- Organization/user: `derekurban`
- Repository: `docolab`
- Workflow filename: `publish.yml`

npm trusted publishing requires Node `22.14.0` or newer and npm CLI `11.5.1` or newer in CI. The workflow uses Node `24`.
