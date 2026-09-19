# @specdev/dsh-archify-manage · Workflow-diagram manager plugin for DSH

English | [简体中文](README.md)

A plugin for DSH (DeepSeek Harness): browse a directory of Archify-generated business
workflow diagrams, read historical versions via Git annotated tags, and register the
currently committed diagram content as a named version ("save version"). The only write
action is attaching an annotated tag to a commit — **it never touches your business
project's files, branches, or commits**.

> This plugin grew out of my exploration of AI-assisted development workflows: the
> methodology and the tool evolved together in the same research. This repository is the
> cleaned-up, open-source home of the plugin.

## Features

- **Three pages**: project home (project + business list) → business page (intro, doc
  entries, diagram list — each diagram shows its snapshot count and a status badge:
  in sync / modified / no snapshot) → reading page (version bar, live-rendered
  interactive diagram, sectioned explanation doc, source-code evidence).
- **Historical versions**: saved versions are Git annotated tags; the reading page
  switches via the version bar, and the diagram, explanation, and evidence all come
  from the selected version (code snippets are taken from the commit pinned by each
  reference).
- **Node details**: click a node on the diagram to read that step's section of the
  explanation for the selected version (missing, unreadable, or unsectioned cases are
  reported honestly — nothing is made up).
- **Save version (the only write action)**: on the "current (working tree)" view,
  register the committed diagram content as a named version; uncommitted changes block
  the save and name the offending file, stale page content requires a refresh first,
  and saving the same content for the same stage twice never creates duplicates.
- **Bundled skill `archify-maker`**: registered into DSH when the plugin loads, ready
  to use after installation; provides a four-stage guide (design → implement →
  evidence → modify) and a workflow-diagram validation command (see
  `skills/archify-maker/` inside the package).

## Installation

Prerequisite: DSH (DeepSeek Harness) installed. The plugin has been verified end to
end (install → configure → use → remove) on DSH 0.1.5-rc.1, web profile.

1. Download `specdev-dsh-archify-manage-<version>.tgz` from the GitHub Release;
2. Install: `dsh plugin --profile web add <path-to-tgz>` (`--profile` selects the
   profile to install into and is **required**; **the path must not contain
   spaces** — a DSH-side limitation; paths with spaces fail with ENOENT, so copy
   the file to a space-free directory first);
3. Configure your business project directory (`repoRoot`). The plugin points to no
   repository by default; if unconfigured, the page shows a copyable config sample.
   Config precedence (later overrides earlier): bundle patch → the profile's own
   `cordis.patch.yml` → home level → `--patch` overlay. Profile-level example
   (**override by id — do not use `- insert:`**, which adds a duplicate entry and
   crashes startup):
   ```yaml
   - id: specdev-archify-manage
     config:
       repoRoot: 'D:/your/business-project-repo'
   ```
4. Restart DSH (config is composed at startup, not hot-reloaded); a 「流程图管理」
   button appears in the sidebar, leading to `/archify-manage/`.

## Expected layout of the business project

The plugin reads the business project through a fixed directory convention:

```text
docs/archify/
  project.json                        # project (schema: specdev-archify/project/1)
  <business-id>/business.json         # business (id / name / intro / docs)
  <business-id>/<chart-id>/chart.json     # chart (id / name / summary; chart numbers are project-wide unique)
  <business-id>/<chart-id>/workflow.json  # chart source (Archify workflow JSON)
  <business-id>/<chart-id>/details.md     # node details
  <business-id>/<chart-id>/evidence.json  # source-code evidence references
```

A saved version = annotated tag `archify/<chart-number>/<version-id>`. On read, five
checks are applied (is an annotated tag, peels to a commit, tag message is valid JSON
with required fields, chart number matches the tag name, directory starts with the
convention root); non-conforming tags are counted as "invalid" and ignored, not
treated as snapshots.

## Pages and API

| Path | Content |
|---|---|
| `/archify-manage/` | Project home: project name + business list |
| `/archify-manage/business/<business-id>` | Business page: intro, doc entries, diagram list (snapshot counts and status badges; numbering conflicts and doc problems are called out) |
| `/archify-manage/read/<business-id>/<chart-id>?v=current\|<tag-name>` | Reading page: version bar + live-rendered interactive diagram + sectioned explanation + source evidence; click a node for details; "current (working tree)" view offers save-version |

API (same origin): read-only `GET /api/inventory`, `/api/chart`, `/api/doc`, and
`GET /api/evidence` (for scripts); `POST /api/evidence` receives the evidence JSON from
the page's own payload for slicing, preventing mismatch when files change between
requests; `/api/snapshots` is **the only write operation** — `GET` is the pre-save
check (current commit, whether saving is allowed, per-file issues, content digest),
`POST` saves a version (`head`/`fingerprint` pin the commit and content you confirmed;
new commits or mismatched content in between are rejected with a refresh request).

## Building from source

Node ≥ 22. In this directory:

```sh
npm install                    # install dev dependencies (esbuild / typescript)
npm run typecheck              # type check (tsc --noEmit)
npm run build                  # build dist/ (esbuild bundle)
npm pack --pack-destination .  # produce specdev-dsh-archify-manage-<version>.tgz
```

(Optional) behavioral smoke test and interface-level acceptance: `node scripts/smoke.mjs`,
`node scripts/check-save.mjs` — self-contained, they generate a temporary sample
repository and never touch your business project.

## Boundaries (honest)

- The only write action is saving a version (attaching an annotated tag); **deleting
  versions, renaming, cross-repository use, and pushing are out of scope**.
- Verified environment: DSH 0.1.5-rc.1 (web profile), Windows, a single machine. No
  end-to-end acceptance with a real AI session (skill trigger → read references →
  produce) has been done, nor verification on another machine.
- Node-level enhanced reading is at step 1 (selection sync + node-detail reading);
  node cross-references, node-detail evidence filtering, and asking DSH from the page
  are future work.
- Rendering and validation rely on the bundled Archify renderer copy (MIT), see
  `vendor/archify-renderer/`; upgrading the copy is a maintainer action.

## License

MIT (see `LICENSE` at the repository root). The bundled Archify renderer copy is also
MIT; its license and third-party notices travel with the copy in
`vendor/archify-renderer/archify/` (`LICENSE`, `THIRD_PARTY_NOTICES.md`).
