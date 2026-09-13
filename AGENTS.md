# AGENTS.md — Folio

These instructions apply to all code, documentation, tests, and tooling in
this repository.

## Project purpose

Folio is a configurable documentation system for Markdown and MDX content. It
turns content files into searchable, server-rendered and client-navigable
documentation sites. Its default theme and client runtime are built with
SolidJS, but the content may document any project, library, API, or product.

The engine uses MDX, Vite, Tailwind CSS v4, Shiki, and the Nikala UI design
system for its default theme and interface components. Developers may use
the Nikala UI CLI when they need additional Nikala UI capabilities:

```bash
bunx @nikala-ui/cli
```

Keep the engine's configuration, routing, compiler, CLI, theme, and runtime
contracts explicit and documented.

## Hardcoding is strictly forbidden

Consumer-specific hardcoding is not allowed. This rule is strict.

Do not hardcode:

- consumer project names, branding, URLs, repository details, or filesystem
  paths;
- page names, navigation labels, site copy, or content belonging to one site;
- component lists, generated file lists, route structures, or feature flags
  that should come from configuration, frontmatter, manifests, or discovery;
- theme choices, colors, layout decisions, or design values that belong to a
  consuming project;
- development-machine paths, credentials, environment values, or deployment
  assumptions;
- framework adapter behavior in generic engine code.

Use typed configuration, documented defaults, frontmatter, manifests,
filesystem discovery, or explicit adapter interfaces instead.

Hardcoded HTML semantics, accessibility labels required by the engine,
protocol constants, and algorithmic values are allowed only when they are
local, named, and part of a documented engine contract.

## File and component size limits

Keep modules small, focused, and easy to review.

- Maximum handwritten source file: **250 non-empty lines**.
- Preferred handwritten source file: **150 non-empty lines or fewer**.
- Maximum component or function: **80 non-empty lines when practical**.
- A file over 250 non-empty lines requires a written justification in the PR
  and a follow-up extraction task.
- One primary responsibility per module.
- One primary UI component per file.
- Split large components into focused components, hooks, utilities, types, or
  rendering helpers before adding more behavior.
- Do not bypass the limit by placing several large components in one file.

Generated snapshots, vendored files, lockfiles, and test fixtures are exempt
from the line limit, but must not be used to hide handwritten complexity.

## TypeScript and SolidJS

- Preserve strict type safety. Do not use `any` to hide an unclear contract.
- Do not destructure reactive SolidJS props directly. Use `splitProps` or
  access props reactively.
- Use Solid's `children` helper when inspecting, iterating, or conditionally
  rendering dynamic children.
- Keep state ownership local and explicit.
- Prefer composable, typed components over large conditional components.
- Keep public types close to the API they describe.
- Avoid duplicate type definitions and speculative abstractions.

## SSR and browser safety

Every runtime path must be safe during server rendering and hydration.

- Guard access to `window`, `document`, `navigator`, storage, observers, and
  browser event listeners.
- Do not perform browser-only work during module evaluation.
- Keep SSR output deterministic and hydration-compatible.
- Test browser behavior whenever changing navigation, layout, themes, or
  client-side state.

## Performance and bundles

- Keep initial client bundles small.
- Preserve route and page code splitting.
- Load Shiki languages and themes lazily; do not eagerly ship the complete
  language catalog in the initial client bundle.
- Do not silence bundle-size warnings without measuring and documenting the
  result.
- Avoid static imports that defeat intended dynamic chunk boundaries.
- Prefer server-side content discovery and compilation where appropriate.

## CLI and generated projects

- CLI commands must work from a clean user project.
- Generated files must use stable, documented paths and local imports.
- Initialization must be safe to run in an existing project and must not
  silently overwrite user-owned files.
- Required generated-project dependencies must be declared explicitly.
- Validate generated output in a temporary project before changing the CLI
  contract.

## Documentation and public APIs

Document every user-visible change in the same pull request, including:

- configuration fields and defaults;
- CLI commands and options;
- generated files and project structure;
- routing, navigation, theme, or rendering behavior;
- migration requirements and breaking changes.

The project documentation lives under `docs/` and is configured through
`docs.config.ts`. Examples must be executable and verified against the actual
engine behavior.

## Validation

Use Bun for project commands:

```bash
bun install
bun test tests
bun run build
bun run docs:build
```

Use `bun run docs:dev` for local development and `bun run docs:preview` to
inspect the production documentation build.

For runtime, CLI, compiler, routing, theme, or build-pipeline changes, run
the full validation set before opening a pull request.

## Roadmap and checklist evidence — STRICT

Roadmap checkboxes are an evidence record, not a progress estimate. Never mark
an item `[x]` because code appears to exist, because a related test passed, or
because the behavior is inferred from another milestone.

Before marking any item `[x]`, all of the following must be true:

- The exact production code path is implemented.
- A dedicated test or documented manual verification checks that exact behavior.
- The validation command has been run successfully in the current worktree.
- Any required output, project, fixture, or artifact exists at a reproducible,
  inspectable path.
- The evidence is recorded next to the item or in the handoff with exact file
  paths, line numbers where useful, commands, and artifact paths.

The following rules are mandatory:

- If any evidence is missing, keep the item `[ ]`.
- A temporary `/tmp` directory created during a test is not an inspectable
  consumer project and must not be described or checked off as one. It may only
  support a separately worded runtime-fixture test item.
- A test that only checks `length`, truthiness, or build completion does not
  prove identity, ordering, isolation, rendering, or user-visible behavior.
  Add assertions for the exact contract.
- Passing unit tests do not prove integration, SSR, browser, visual, or HMR
  behavior. Keep those items unchecked until the relevant evidence exists.
- Do not move an implementation from one milestone to another by marking the
  destination milestone complete after the fact. Record what was already
  implemented and verify the destination milestone independently.
- Do not update a checkbox first and justify it later. Finish the work, run the
  verification, audit every item, then update the checklist once.
- When uncertain, prefer `[ ]` and report the missing evidence explicitly.
- Before handoff, audit every newly changed `[x]` and be able to answer:
  `What exact code, what exact assertion, what exact command, and what exact
  inspectable artifact prove this item?`

## Truthfulness and no invention — ABSOLUTE

Inventing code, solutions, files, projects, artifacts, test results, commands,
implementation status, or completion claims is forbidden. Do not describe a
solution as implemented unless the solution actually exists in the worktree and
has been inspected. Do not claim a file or project exists unless its exact path
has been verified. Do not claim a test, build, browser check, or manual
verification passed unless that exact command or verification was actually run
and its result was observed.

If the requested solution does not exist, is incomplete, or cannot be verified,
state that plainly. Use `[ ]`, not `[x]`, for incomplete or unverified roadmap
items. Never fill an evidence gap with an assumption, a plausible explanation,
an ephemeral side effect, or a future plan. The only acceptable completion claim
is one supported by real code, real output, and recorded verification evidence.

## Git and pull requests

- Keep commits focused and logically atomic.
- `main` is protected for this workflow: do not check it out, modify it,
  merge into it, rebase onto it, or push to it unless the user gives explicit
  permission.
- Each roadmap milestone must use its own branch created from `development`.
- Completed milestone branches may be merged only into `development`.
- Treat `development` as the integration branch for milestone work; never use
  `main` as the integration target.
- Do not commit `node_modules/`, build output, local test projects, editor
  files, credentials, or unrelated generated files.
- Do not reformat unrelated code.
- Explain the problem, design decision, affected public behavior, validation
  performed, and migration impact in every pull request.
- A passing build is not proof of correct browser behavior; verify relevant
  navigation flows and viewports manually when UI behavior changes.
