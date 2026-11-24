/**
 * Post-migration parity: the migrated core.ts vs the ORIGINAL core.ts.
 *
 * Both versions come from git (HEAD still holds the pre-migration core.ts) and
 * are driven through their REAL entry point -- `markdownToMindElixir(context)`
 * -- rather than by re-typing the conversion functions. The stubs below make
 * that possible:
 *
 *   1. `vscode` is imported at module scope, so a stub package is planted in
 *      the sandbox. It answers exactly the three questions core.ts asks:
 *      which document is active, what `mindElixirMarkdown.h1AsRoot` is set to,
 *      and the editor font/language.
 *   2. `./panel` is stubbed too, so the tree each version hands to
 *      `MindElixirPanel.init()` can be captured without a real webview. The
 *      panel title is captured alongside it, because a migration that renders
 *      the same map under a different name is still a behaviour change.
 *   3. `./utils` only does `vscode.workspace.fs` reads, which the entry point
 *      never reaches, but it still has to resolve at import time.
 *   4. The sources use `import { NodeObj } from 'mind-elixir'` -- a type
 *      imported as a value. esbuild erases those the way the real build does;
 *      running the TS directly would demand runtime exports that exist only in
 *      the .d.ts, so every file goes through esbuild.
 *
 * The sandboxed `@mind-elixir/import-markdown` re-exports the LOCAL build of
 * the package, not the published 0.0.1 from the registry -- 0.0.1 predates
 * `rehypePlugins`, without which the migration cannot carry code highlighting
 * over at all.
 *
 * Run: node scripts/parity-vscode.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const REPO = path.resolve(new URL("..", import.meta.url).pathname);
const LOCAL_PKG =
	"/Users/darksouls/projects/plugins/packages/import-markdown";

const ORIG_CORE = execFileSync("git", ["show", "HEAD:src/core.ts"], {
	cwd: REPO,
	encoding: "utf8",
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-parity-"));
const write = (rel, content) => {
	const p = path.join(tmp, rel);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content);
	return p;
};

// --- vscode stub -----------------------------------------------------------
// Only the surface core.ts actually touches. `getConfiguration` is the one
// that matters for parity: `h1AsRoot` is a user setting, so the harness drives
// every fixture through both values instead of assuming the default.
const vscodeStub = `
export const ViewColumn = { One: 1 };
export const env = { language: 'en' };
export const window = {
  activeTextEditor: null,
  showInformationMessage() {},
  showErrorMessage() {},
};
export const workspace = {
  fs: { readFile: async () => new Uint8Array(), writeFile: async () => {} },
  getConfiguration() {
    return { get: key => (key === 'h1AsRoot' ? globalThis.__H1_AS_ROOT__ : undefined) };
  },
  onDidChangeTextDocument() { return { dispose() {} }; },
  showSaveDialog: async () => undefined,
};
`;
write(
	"node_modules/vscode/package.json",
	JSON.stringify({ name: "vscode", version: "0.0.0", type: "module", main: "./i.mjs", exports: { ".": "./i.mjs" } }),
);
write("node_modules/vscode/i.mjs", vscodeStub);
const VSCODE_STUB_URL = pathToFileURL(path.join(tmp, "node_modules/vscode/i.mjs")).href;

// --- panel stub ------------------------------------------------------------
// Captures what each version would have rendered, plus the window title.
const panelStub = `
export class MindElixirPanel {
  constructor(extensionUri, name, isPlaintext, locale) {
    this.name = name;
    this.isPlaintext = isPlaintext;
    this.locale = locale;
    this.panel = {
      webview: {
        html: '',
        onDidReceiveMessage() { return { dispose() {} }; },
        postMessage() {},
      },
      onDidDispose() { return { dispose() {} }; },
      dispose() {},
    };
  }
  async init(nodeData) {
    globalThis.__RESULT__ = {
      data: nodeData,
      title: this.name,
      isPlaintext: this.isPlaintext,
      locale: this.locale,
    };
  }
  async download() {}
}
`;
write("node_modules/panel-stub.mjs", panelStub);

write("node_modules/utils-stub.mjs", "export const getFileContentAsString = async () => '';\nexport const saveFile = async () => {};\n");

// local build of the shared package
const realPkg = path.join(LOCAL_PKG, "dist/index.js");
if (!fs.existsSync(realPkg)) {
	console.error(`local package build not found: ${realPkg}\nrun: pnpm --filter @mind-elixir/import-markdown build`);
	process.exit(1);
}
write(
	"node_modules/@mind-elixir/import-markdown/package.json",
	JSON.stringify({ name: "@mind-elixir/import-markdown", version: "0.0.1-local", type: "module", main: "./i.mjs", exports: { ".": "./i.mjs" } }),
);
write(
	"node_modules/@mind-elixir/import-markdown/i.mjs",
	`export * from ${JSON.stringify(pathToFileURL(realPkg).href)};\n`,
);

write("package.json", JSON.stringify({ name: "vscode-parity", type: "module", private: true }));

// --- specifier rewriting ---------------------------------------------------
// `import.meta.resolve` is the ESM authority: require.resolve applies CJS rules
// and misses subpath exports such as mind-elixir's "./plaintextConverter".
//
// The shared package is the exception -- it must resolve to the LOCAL build
// planted in tmp, not to the registry copy in the repo's node_modules (0.0.1
// predates `rehypePlugins`). So it is redirected before the generic pass.
const RESOLVE_BASE = pathToFileURL(REPO + path.sep);
const LOCAL_PKG_URL = pathToFileURL(tmp + "/node_modules/@mind-elixir/import-markdown/i.mjs").href;
const rewrite = code => {
	code = code.replace(/from\s*(["'])@mind-elixir\/import-markdown\1/g, `from "${LOCAL_PKG_URL}"`);
	return code.replace(/from\s*(["'])([^"'.][^"']*)\1/g, (m, q, spec) => {
		let r;
		try {
			r = import.meta.resolve(spec, RESOLVE_BASE);
		} catch {
			return m;
		}
		return `from ${q}${r}${q}`;
	});
};

const build = async (name, source) => {
	const code = rewrite(
		source
			.replace(/from\s*(["'])\.\/panel\1/g, `from "./node_modules/panel-stub.mjs"`)
			.replace(/from\s*(["'])\.\/utils\1/g, `from "./node_modules/utils-stub.mjs"`),
	);
	const { outputFiles } = await esbuild.build({
		stdin: { contents: code, resolveDir: tmp, sourcefile: `${name}.ts`, loader: "ts" },
		bundle: false,
		write: false,
		format: "esm",
		target: "es2022",
	});
	return write(`${name}.mjs`, outputFiles[0].text);
};

const origMjs = await build("original-core", ORIG_CORE);
const migMjs = await build("migrated-core", fs.readFileSync(path.join(REPO, "src/core.ts"), "utf8"));

const { markdownToMindElixir: original } = await import(pathToFileURL(origMjs).href);
const { markdownToMindElixir: migrated } = await import(pathToFileURL(migMjs).href);

/**
 * Run one entry point over a document and return what it handed the panel.
 *
 * The entry point is `async` and reads `vscode.window.activeTextEditor`, so the
 * document is injected through the stub rather than passed in.
 */
const run = async (entry, md, { h1AsRoot, fileName = "doc.md" }) => {
	globalThis.__H1_AS_ROOT__ = h1AsRoot;
	globalThis.__RESULT__ = undefined;
	// The stub, not the repo's node_modules: it is the only place
	// `activeTextEditor` and `__H1_AS_ROOT__` are actually implemented.
	const vscode = await import(VSCODE_STUB_URL);
	vscode.window.activeTextEditor = {
		document: {
			fileName: path.join("/tmp/md", fileName),
			getText: () => md,
			uri: { toString: () => `file://${fileName}` },
		},
	};
	// A minimal ExtensionContext: core.ts pushes subscriptions onto it.
	const context = { subscriptions: [], extensionUri: {} };
	await entry(context)();
	if (!globalThis.__RESULT__) throw new Error("entry point produced no panel data");
	return globalThis.__RESULT__;
};

// --- comparison ------------------------------------------------------------
/**
 * Fold random ids and object key order.
 *
 * Random ids become positional anchors; offset-derived ids (deterministic per
 * document) are kept because they mark source positions. The root id is folded
 * too -- the original hard-codes 'root' and the migrated version pins it back,
 * so it matches by construction and asserting it adds nothing. Keys are sorted
 * because the two implementations build objects in different orders, which is a
 * construction detail rather than a behaviour difference.
 */
const norm = (node, map = new Map()) => {
	if (Array.isArray(node)) return node.map(n => norm(n, map));
	if (!node || typeof node !== "object") return node;
	const out = {};
	for (const k of Object.keys(node).sort()) {
		const v = node[k];
		if (k === "id" && v !== "root") {
			const s = String(v);
			if (/^\d+$/.test(s)) {
				out[k] = s;
				continue;
			}
			if (!map.has(s)) map.set(s, `#g${map.size + 1}#`);
			out[k] = map.get(s);
			continue;
		}
		out[k] = norm(v, map);
	}
	return out;
};

const DOCS = {
	"plain paragraph": "just a paragraph\n",
	"heading tree": "# T\n\n## A\n\ntext a\n\n### A1\n\ndeep\n\n## B\n\ntext b\n",
	"paragraph then list": "intro para\n\n- one\n- two\n\n## After\n\ntail\n",
	"list under heading": "## Section\n\n- one\n- two\n\ntail paragraph\n",
	"nested list": "- one\n  - one.a\n  - one.b\n- two\n",
	"inline markdown": "## Formatting\n\n**bold** and `code` and [link](https://example.com)\n",
	"gfm table": "## T\n\n| a | b |\n| - | - |\n| 1 | 2 |\n",
	"image": "## Img\n\n![alt](a.png)\n",
	"code block": "## Code\n\n```js\nconst a = 1\n```\n",
	"code block python": "## Code\n\n```python\ndef f(x):\n    return x\n```\n",
	"code block unknown lang": "## Code\n\n```notalang\nsome text\n```\n",
	"inline code": "## T\n\ncall `foo()` now\n",
	"html passthrough": "## H\n\n<div>raw <b>html</b></div>\n",
	frontmatter: "---\ntitle: From Frontmatter\ntags: [a]\n---\n\n## Body\n\ntext\n",
	"frontmatter no title": "---\ntags: [a]\n---\n\n## Body\n\ntext\n",
	"thematic break": "## A\n\ntext a\n\n---\n\n## B\n\ntext b\n",
	empty: "",
	blockquote: "## Q\n\n> quoted text\n",
	"deep nest": "## A\n\n### B\n\n#### C\n\n##### D\n\ndeep text\n",
	"list then heading": "- x\n- y\n\n## After\n\ntext\n",
	"multi child heading": "# The **bold** `heading`\n\n## Sub\n\nbody\n",
	"h1 after h2": "## First H2\n\nbody\n\n# Later H1\n\nmore\n",
	"task list": "## Tasks\n\n- [ ] todo\n- [x] done\n",
	"strikethrough": "## S\n\n~~gone~~\n",
	"autolink": "## L\n\nvisit https://example.com now\n",
};

/**
 * Differences that are intentional, each traced to a concrete defect or
 * limitation in the original. Matched by substring against diff lines.
 */
const ALLOWED = [
	{
		match: ".id: missing in original",
		reason:
			"COMPLETENESS. For a top-level `list` node the original hit an early `continue` and never assigned an `id`; the package assigns one. mind-elixir needs `id` on every node.",
	},
	{
		match: ".children[0].id: missing in original",
		reason:
			"COMPLETENESS. Same early-`continue` path: list nodes nested under a heading also lacked `id` in the original.",
	},
	{
		// Scoped to frontmatter documents on purpose. Everywhere else the two
		// agree on the number, which is what makes this a rebasing artefact
		// rather than a masked structural change.
		match: ".id: \"",
		onlyFor: c => c.label.startsWith("frontmatter"),
		reason:
			"ID BASE, structure intact — every differing line is an `.id` and nothing else. The original kept the `yaml` node in the AST (via remark-frontmatter) and skipped it later, so offset-derived ids were relative to the ORIGINAL document (e.g. 43). The package strips the block before parsing, so the same node's id is relative to the STRIPPED text (e.g. 1). The id is an opaque handle — the only property that matters is that it is unique within a document, asserted separately below — and the debounced re-parse regenerates the whole tree on every keystroke anyway, so no cross-parse identity is lost.",
	},
];

/** A case is explained when every one of its diff lines is covered by a rule. */
const coverOf = (d) => {
	const usable = ALLOWED.filter(a => !a.onlyFor || a.onlyFor(d));
	const rules = usable.filter(a => d.d.some(line => line.includes(a.match)));
	const covered = d.d.filter(line => rules.some(a => line.includes(a.match)));
	return { rules, allCovered: covered.length === d.d.length };
};

/**
 * Every node must carry an id, and no id may repeat within one document.
 *
 * This is the invariant that makes the offset-rebasing difference above
 * acceptable: an id only has to be a unique handle. Asserting it separately
 * means a real id collision cannot hide behind a permissive ALLOWED rule.
 */
const idProblems = (data) => {
	const seen = new Map();
	const problems = [];
	const walk = (node, p) => {
		if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${p}[${i}]`));
		if (!node || typeof node !== "object") return;
		if (node.id === undefined) problems.push(`${p}: missing id`);
		else if (seen.has(node.id)) problems.push(`${p}: duplicate id ${node.id} (also at ${seen.get(node.id)})`);
		else seen.set(node.id, p);
		walk(node.children, `${p}.children`);
	};
	walk(data, "root");
	return problems;
};

/** Collect the first few structural mismatches, by JSON path. */
const findDiffs = (a, b, p = "", acc = []) => {
	if (acc.length >= 6) return acc;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) {
			acc.push(`${p}: array-ness differs`);
			return acc;
		}
		if (a.length !== b.length) {
			acc.push(`${p}: length ${a.length} vs ${b.length}`);
			return acc;
		}
		a.forEach((v, i) => findDiffs(v, b[i], `${p}[${i}]`, acc));
		return acc;
	}
	if (a && b && typeof a === "object" && typeof b === "object") {
		const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
		for (const k of keys) {
			if (!(k in a)) {
				acc.push(`${p}.${k}: missing in original`);
				continue;
			}
			if (!(k in b)) {
				acc.push(`${p}.${k}: missing in migrated`);
				continue;
			}
			findDiffs(a[k], b[k], `${p}.${k}`, acc);
			if (acc.length >= 6) return acc;
		}
		return acc;
	}
	if (a !== b) acc.push(`${p}: ${JSON.stringify(a)?.slice(0, 160)} vs ${JSON.stringify(b)?.slice(0, 160)}`);
	return acc;
};

let same = 0;
const unexplained = [];
const explained = [];
const idFailures = [];
const cases = [];

for (const [label, md] of Object.entries(DOCS)) {
	for (const h1AsRoot of [false, true]) {
		cases.push({ label: h1AsRoot ? `${label} (h1AsRoot)` : label, md, h1AsRoot });
	}
}

// plaintext documents take the other branch entirely; the migration must not
// have disturbed it, so they are compared too.
const PLAINTEXT = {
	"plaintext list": "- root\n  - child a\n  - child b\n- sibling\n",
	"plaintext nested": "- a\n    - a1\n    - a2\n- b\n",
};
for (const [label, md] of Object.entries(PLAINTEXT)) {
	cases.push({ label: `PLAINTEXT ${label}`, md, h1AsRoot: false });
}

console.log("# post-migration parity: migrated core.ts vs git HEAD core.ts\n");

for (const c of cases) {
	const ro = await run(original, c.md, { h1AsRoot: c.h1AsRoot });
	const rm = await run(migrated, c.md, { h1AsRoot: c.h1AsRoot });

	// The migrated tree must be internally consistent regardless of whether it
	// matches the original, so this runs on every case, not only differing ones.
	for (const p of idProblems(rm.data)) idFailures.push(`${c.label}: ${p}`);

	const ao = norm(ro);
	const am = norm(rm);
	if (JSON.stringify(ao) === JSON.stringify(am)) {
		same++;
		continue;
	}
	const d = { ...c, ao, am, d: findDiffs(ao, am, "root") };
	const { rules, allCovered } = coverOf(d);
	if (allCovered) explained.push({ d, allowed: rules });
	else unexplained.push(d);
}

console.log(
	`${same}/${cases.length} identical, ${explained.length} explained difference(s), ${unexplained.length} unexplained\n`,
);
console.log(`id invariant (every node has a unique id): ${idFailures.length === 0 ? "OK" : `${idFailures.length} VIOLATION(S)`}`);
for (const f of idFailures) console.log(`  ${f}`);
console.log("");
for (const { d, allowed } of explained) {
	console.log(`DIFF ${d.label}`);
	for (const line of d.d) console.log(`   ${line}`);
	for (const a of allowed) console.log(`   => ${a.reason}`);
	console.log("");
}
for (const d of unexplained) {
	console.log(`UNEXPLAINED ${d.label}`);
	for (const line of d.d) console.log(`   ${line}`);
	console.log("");
}
const ok = unexplained.length === 0 && idFailures.length === 0;
console.log(
	ok
		? "PARITY: migration changed nothing beyond the signed-off improvements"
		: `PARITY: ${unexplained.length} unexplained difference(s), ${idFailures.length} id invariant violation(s)`,
);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
