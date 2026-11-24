# Change Log

All notable changes to the "mind-elixir" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.1.1] - 2026-11-24
- Add VS Code parser parity test script for verifying markdown parsing consistency.
- Add manually triggered release workflow (build, publish, tag, release).

## [1.1.0] - 2026-05-22
- Implement markdown-it plugin to render MindElixir mindmaps directly inside VSCode standard markdown previews (e.g. using `mindmap` code blocks).
- Integrate KaTeX `mhchem` extension for high-quality chemical formula rendering.
- Bundle required stylesheet and font assets in esbuild configuration for seamless offline math/chemistry formula rendering.

## [1.0.1] - 2026-05-22
- Fix secret leak issue by updating `.vscodeignore` to exclude private token files.

## [1.0.0] - 2026-05-22
- Real-time bidirectional sync between editor and webview with debouncing.
- Upgrade mind-elixir dependency to 5.11.3.
- Remove pointer-events override from map-container elements.
- Rewrite AST to mindmap transformation logic.