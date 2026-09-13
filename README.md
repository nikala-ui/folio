# @nikala-ui/folio

![Folio documentation site](.github/assets/screenshot.png)

[![CI](https://github.com/nikala-ui/folio/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/nikala-ui/folio/actions/workflows/main.yml)
[![npm version](https://img.shields.io/npm/v/%40nikala-ui%2Ffolio)](https://www.npmjs.com/package/@nikala-ui/folio)
[![npm downloads](https://img.shields.io/npm/dm/%40nikala-ui%2Ffolio)](https://www.npmjs.com/package/@nikala-ui/folio)
[![License](https://img.shields.io/github/license/nikala-ui/folio)](https://github.com/nikala-ui/folio/blob/main/LICENSE)

`@nikala-ui/folio` is a file-based documentation engine for SolidJS projects.
It compiles MDX content with Vite, renders server-side pages, and provides a
responsive documentation theme with navigation, search, syntax highlighting,
and Tailwind CSS v4 design tokens.

## Features

- File-based MDX routes from a configurable content directory.
- Automatic sidebar categories derived from content directories.
- Server-rendered production pages with client-side navigation.
- Responsive sidebar, top navigation, breadcrumbs, table of contents, and
  previous/next page navigation.
- Local search and configurable page metadata.
- Shiki syntax highlighting with lazy language and theme loading.
- Custom themes, layouts, components, CSS, logos, and site metadata.
- Typed plugin lifecycle for production builds and development reloads, with
  immutable page/config snapshots and actionable hook errors.
- CLI initialization for a complete documentation project.

The default theme uses the Nikala UI design system. Additional Nikala UI
capabilities can be added from a generated project with:

```bash
bunx @nikala-ui/cli
```

## Installation

Install the engine in an existing SolidJS project with your preferred package
manager:

```bash
# Bun
bun add @nikala-ui/folio

# pnpm
pnpm add @nikala-ui/folio

# npm
npm install @nikala-ui/folio

# yarn
yarn add @nikala-ui/folio
```

## Initialize a project

Run the initializer from the project directory:

```bash
# Bun
bunx @nikala-ui/folio init .

# pnpm
pnpm dlx @nikala-ui/folio init .

# npm
npx @nikala-ui/folio init .

# yarn
yarn dlx @nikala-ui/folio init .
```

The initializer creates the documentation structure, prepares the default
theme, configures the `@/*` TypeScript alias, and installs the dependencies
required by the generated project.

```text
.
├── docs/
│   └── index.mdx
├── docs.config.ts
├── nikala.config.json
├── public/
│   └── favicon.ico
└── src/
    ├── components/ui/
    ├── hooks/
    ├── index.css
    ├── lib/
    ├── providers/
    └── themes/default/
```

The generated project receives `dev`, `build`, and `preview` scripts when
they are not already defined. Existing `docs.config.ts` and
`nikala.config.json` files are preserved.

## Run a documentation project

From the generated project root:

```bash
# Development server
bun run dev

# Production build
bun run build

# Production preview
bun run preview
```

The equivalent commands are `pnpm run ...`, `npm run ...`, and `yarn ...`.
The default development server runs at `http://localhost:1862/`.

The CLI commands can also be run directly:

```bash
bunx @nikala-ui/folio dev
bunx @nikala-ui/folio build
bunx @nikala-ui/folio preview
```

## Content structure

The default content directory is `docs/`. Every MDX file becomes a route and
directories become sidebar categories:

```text
docs/
├── index.mdx              -> /
├── getting-started.mdx    -> /getting-started
├── components/
│   ├── button.mdx         -> /components/button
│   └── dialog.mdx         -> /components/dialog
└── guides/
    └── theming.mdx        -> /guides/theming
```

Page metadata is defined with frontmatter:

```mdx
---
title: Button
description: A flexible action button for SolidJS applications.
order: 1
toc: true
---

# Button

Button documentation goes here.
```

Supported page metadata includes `title`, `description`, `order`,
`categoryOrder`, `icon`, `badge`, `addedAt`, `prev`, `next`, and `toc`.

## Configuration

Create `docs.config.ts` in the project root:

```ts
import type { DocsConfig } from "@nikala-ui/folio";

const config: DocsConfig = {
  title: "Project Documentation",
  description: "Documentation for my SolidJS project.",
  siteUrl: "https://docs.example.com",
  contentDir: "docs",
  favicon: "/favicon.ico",
  navigation: {
    layout: "sidebar",
    navbar: [{ title: "Home", href: "/" }],
    sidebar: {
      nav: "auto",
      header: true,
      footer: false,
      headerSubtitle: "Documentation",
    },
  },
  search: {
    enabled: true,
  },
};

export default config;
```

See the [Configuration](/configuration) guide for the supported options.

## Plugin status

The plugin API is public and integrated with production builds, development
reloads, generated projects, and the browser/SSR validation suite. See the
[plugin authoring guide](docs/configuration/plugins.mdx) for lifecycle order,
hook contracts, immutable inputs, error handling, and compatibility policy.

The API is pre-1.0 and therefore follows a compatible-minor policy: plugin
packages should pin a compatible Folio minor range such as `~0.15.0`. The
current contract supports page metadata transformation while preserving route
identity; adding routes or replacing source MDX requires a separately defined
future API. This release adds no breaking plugin contract change and requires
no migration.

## Customize the theme

The generated default theme is under `src/themes/default`. It can be
modified directly or replaced with a custom theme configured through
`theme.path`.

The generated `src/index.css` contains the Tailwind CSS v4 entrypoint and
semantic design tokens. Customize those tokens to change the site's colors,
typography, spacing, and other visual properties.

## Develop the engine

Clone the repository and install its dependencies:

```bash
git clone https://github.com/nikala-ui/folio.git
cd folio
bun install
```

Useful repository commands:

```bash
bun run typecheck    # Run the strict TypeScript check
bun run test         # Run unit and integration tests
bunx playwright install chromium # Install the local browser test runtime
bun run test:browser # Run browser, SSR, and hydration smoke tests
bun run test:generated # Test a clean generated consumer project
bun run package:check  # Validate the publishable package artifact
bun run bundle:check   # Report and validate production bundle sizes
bun run build        # Build the engine and CLI into dist/
bun run docs:build   # Build the self-hosted site into .docs-dist/
bun run check        # Run the complete local quality contract
bun run docs:dev     # Run the self-hosted docs site
bun run docs:preview # Preview the self-hosted production site
```

Read [Contributing](/contributing) before opening a pull request.
