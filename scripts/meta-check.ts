#!/usr/bin/env -S deno run --allow-read

/**
 * Scaffolding and documentation gate.
 *
 * Verifies, mechanically, every claim the agent scaffolding and the
 * living-state docs make that a program can reach: overlay symlinks, index
 * parity, link resolution, task names, generated-file banners, and the prose
 * bans that `.agents/rules/doc-voice.md` describes.
 *
 * A rule sentence that could be a check belongs here instead. When a check
 * lands, the prose that asserted the same thing shrinks to a pointer.
 *
 * ## Validated against
 *
 * A gate that passes on a healthy tree has shown nothing. Every check below was
 * validated by injecting the defect it claims to catch and confirming it fired:
 * a symlink replaced by a regular file; an unindexed rule and an indexed ghost;
 * a skill frontmatter with its name removed; an unregistered top-level doc and a
 * registry entry pointing at nothing; a dead relative link; a documented task
 * absent from deno.json; a script naming a renamed workspace path; a generated
 * file stripped of its banner; a hardcoded implementation count; each prose ban
 * (bolded `R*`, a bracketed code span with no target, a habitual em-dash, an
 * over-long sentence, an `.agents/` link on a human page); an over-budget
 * CLAUDE.md; an unlisted subagent and a broken `.claude/agents` symlink; a
 * subagent whose frontmatter name mismatches its filename; an indented `tools:`
 * or `model:` key swallowed into the description; and a doc naming an archived
 * implementation file or a directory that does not exist; and a link `#anchor`
 * matching no heading, in the same file, across files, and after a heading was
 * renamed out from under an inbound link. All twenty-seven were caught, and a
 * valid anchor was confirmed not to fire.
 *
 * The indented-key case is not hypothetical. It was live in this repository's
 * researcher agent, silently voiding its tool allowlist and model setting.
 *
 * Not measured: whether the prose bans have a false-positive rate on prose
 * nobody has written yet. Code spans and fenced blocks are stripped first,
 * which is what kept them quiet on the existing corpus.
 *
 * Usage: deno task meta-check
 */

import { walk } from '@std/fs/walk';
import { dirname, join, normalize, relative, resolve } from '@std/path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------------------
// Failure collection
// ---------------------------------------------------------------------------

interface Failure {
	check: string;
	where: string;
	message: string;
}

const failures: Failure[] = [];
let checksRun = 0;

function fail(check: string, where: string, message: string): void {
	failures.push({ check, where, message });
}

function rel(path: string): string {
	return relative(ROOT, path) || '.';
}

// ---------------------------------------------------------------------------
// Repository inventory
// ---------------------------------------------------------------------------

/** Markdown this repository authors and is therefore accountable for. */
const OWNED_MARKDOWN_SKIP = [
	/\.git\//,
	/node_modules/,
	/\.temp\//,
	/_site\//,
	/\/fixtures\//,
	/\.serena\//,
	/coverage\//,
];

/** Human-facing first-read surfaces, per the audience split in doc-voice.md. */
const HUMAN_PREFIXES = ['README.md', 'PRODUCTION-GUIDE.md', 'docs/', 'packages/'];

/** Generated files: banner required, hand-edits forbidden. */
const GENERATED_FILES: Record<string, string> = {
	'BENCHMARKS.md': 'scripts/update-benchmarks.ts',
	'docs/analyses/benchmark-statistics.md': 'scripts/analyze-benchmarks.ts',
};

async function exists(path: string): Promise<boolean> {
	try {
		await Deno.stat(path);
		return true;
	} catch {
		return false;
	}
}

async function ownedMarkdown(): Promise<string[]> {
	const out: string[] = [];
	for await (const entry of walk(ROOT, { exts: ['.md'], skip: OWNED_MARKDOWN_SKIP })) {
		out.push(entry.path);
	}
	return out.sort();
}

async function readText(path: string): Promise<string> {
	return await Deno.readTextFile(path);
}

/** Strip fenced and inline code so prose bans do not fire on code samples. */
function proseOnly(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ' '))
		.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
}

function lineOf(text: string, index: number): number {
	return text.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// Check: overlay symlinks resolve
// ---------------------------------------------------------------------------

/**
 * A canonical rule whose overlay has died is silently unloaded, and that
 * failure is invisible at exactly the moment it matters. A bulk in-place edit
 * that follows a symlink turns it into a regular file, which is the usual way
 * this breaks.
 */
async function checkOverlaySymlinks(): Promise<void> {
	checksRun++;
	const expected: Array<[string, string]> = [
		['.claude/rules', '.agents/rules'],
		['.claude/skills', '.agents/skills'],
		['.claude/agents', '.agents/agents'],
		['.cursorrules', 'CLAUDE.md'],
	];

	for (const [link, target] of expected) {
		const linkPath = join(ROOT, link);
		let info: Deno.FileInfo;
		try {
			info = await Deno.lstat(linkPath);
		} catch {
			fail('overlay-symlinks', link, `missing; expected a symlink to ${target}`);
			continue;
		}
		if (!info.isSymlink) {
			fail(
				'overlay-symlinks',
				link,
				`is a regular file, not a symlink to ${target}. An in-place edit followed the link and replaced it.`,
			);
			continue;
		}
		const resolved = resolve(dirname(linkPath), await Deno.readLink(linkPath));
		if (resolved !== join(ROOT, target)) {
			fail('overlay-symlinks', link, `points at ${rel(resolved)}, expected ${target}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: rule and skill index parity
// ---------------------------------------------------------------------------

/**
 * An unindexed rule is undiscoverable; an indexed ghost is a broken promise.
 * Both directions are checked against `.agents/README.md`.
 */
async function checkIndexParity(): Promise<void> {
	checksRun++;
	const indexPath = join(ROOT, '.agents/README.md');
	if (!await exists(indexPath)) {
		fail('index-parity', '.agents/README.md', 'missing; it is the canonical rule and skill index');
		return;
	}
	const index = await readText(indexPath);

	// Rules: one file per .agents/rules/*.md, one row per file.
	const ruleFiles = new Set<string>();
	for await (const entry of Deno.readDir(join(ROOT, '.agents/rules'))) {
		if (entry.isFile && entry.name.endsWith('.md')) ruleFiles.add(entry.name);
	}
	const ruleRows = new Set(
		[...index.matchAll(/\]\(rules\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]!),
	);
	for (const file of ruleFiles) {
		if (!ruleRows.has(file)) {
			fail('index-parity', `.agents/rules/${file}`, 'not listed in the Rules table of .agents/README.md');
		}
	}
	for (const row of ruleRows) {
		if (!ruleFiles.has(row)) {
			fail('index-parity', '.agents/README.md', `Rules table lists rules/${row}, which does not exist`);
		}
	}

	// Skills: one directory per .agents/skills/*/, each with a SKILL.md.
	const skillDirs = new Set<string>();
	for await (const entry of Deno.readDir(join(ROOT, '.agents/skills'))) {
		if (entry.isDirectory) skillDirs.add(entry.name);
	}
	const skillRows = new Set(
		[...index.matchAll(/\]\(skills\/([a-z0-9-]+)\/SKILL\.md\)/g)].map((m) => m[1]!),
	);
	for (const dir of skillDirs) {
		if (!await exists(join(ROOT, '.agents/skills', dir, 'SKILL.md'))) {
			fail('index-parity', `.agents/skills/${dir}`, 'has no SKILL.md');
		}
		if (!skillRows.has(dir)) {
			fail('index-parity', `.agents/skills/${dir}`, 'not listed in the Skills table of .agents/README.md');
		}
	}
	for (const row of skillRows) {
		if (!skillDirs.has(row)) {
			fail('index-parity', '.agents/README.md', `Skills table lists skills/${row}, which does not exist`);
		}
	}

	// Agents: one file per .agents/agents/*.md, one row per file.
	const agentFiles = new Set<string>();
	for await (const entry of Deno.readDir(join(ROOT, '.agents/agents'))) {
		if (entry.isFile && entry.name.endsWith('.md')) agentFiles.add(entry.name);
	}
	const agentRows = new Set(
		[...index.matchAll(/\]\(agents\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]!),
	);
	for (const file of agentFiles) {
		if (!agentRows.has(file)) {
			fail('index-parity', `.agents/agents/${file}`, 'not listed in the Agents table of .agents/README.md');
		}
	}
	for (const row of agentRows) {
		if (!agentFiles.has(row)) {
			fail('index-parity', '.agents/README.md', `Agents table lists agents/${row}, which does not exist`);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: subagent frontmatter keys are real keys
// ---------------------------------------------------------------------------

/**
 * A subagent definition whose `tools:` or `model:` line is indented under
 * `description:` is swallowed into that string, so the restriction silently
 * never applies. That is invisible in review and cost this repository its
 * researcher agent's tool allowlist, so it is checked rather than remembered.
 */
async function checkAgentFrontmatter(): Promise<void> {
	checksRun++;
	for await (const entry of Deno.readDir(join(ROOT, '.agents/agents'))) {
		if (!entry.isFile || !entry.name.endsWith('.md')) continue;
		const path = join(ROOT, '.agents/agents', entry.name);
		const text = await readText(path);
		const front = text.match(/^---\n([\s\S]*?)\n---/);
		if (!front) {
			fail('agent-frontmatter', rel(path), 'missing YAML frontmatter block');
			continue;
		}
		const body = front[1]!;
		if (!/^name:\s*\S/m.test(body)) fail('agent-frontmatter', rel(path), 'frontmatter has no top-level name:');
		if (!/^description:/m.test(body)) {
			fail('agent-frontmatter', rel(path), 'frontmatter has no top-level description:');
		}
		const name = body.match(/^name:\s*(\S+)/m)?.[1];
		const stem = entry.name.replace(/\.md$/, '');
		if (name && name !== stem) {
			fail('agent-frontmatter', rel(path), `frontmatter name "${name}" does not match filename "${stem}"`);
		}
		for (const key of ['tools', 'model']) {
			// Indented means it was folded into the previous key's value.
			const indented = new RegExp(`^[ \\t]+${key}:`, 'm');
			if (indented.test(body) && !new RegExp(`^${key}:`, 'm').test(body)) {
				fail(
					'agent-frontmatter',
					rel(path),
					`\`${key}:\` is indented, so it is parsed as part of the previous value instead of a key`,
				);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: skill frontmatter
// ---------------------------------------------------------------------------

/** A skill without a name and description cannot be selected by an agent. */
async function checkSkillFrontmatter(): Promise<void> {
	checksRun++;
	for await (const entry of Deno.readDir(join(ROOT, '.agents/skills'))) {
		if (!entry.isDirectory) continue;
		const path = join(ROOT, '.agents/skills', entry.name, 'SKILL.md');
		if (!await exists(path)) continue;
		const text = await readText(path);
		const front = text.match(/^---\n([\s\S]*?)\n---/);
		if (!front) {
			fail('skill-frontmatter', rel(path), 'missing YAML frontmatter block');
			continue;
		}
		const body = front[1]!;
		if (!/^name:\s*\S/m.test(body)) fail('skill-frontmatter', rel(path), 'frontmatter has no name:');
		if (!/^description:/m.test(body)) fail('skill-frontmatter', rel(path), 'frontmatter has no description:');
		const name = body.match(/^name:\s*(\S+)/m)?.[1];
		if (name && name !== entry.name) {
			fail('skill-frontmatter', rel(path), `frontmatter name "${name}" does not match directory "${entry.name}"`);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: living-state registry parity
// ---------------------------------------------------------------------------

/**
 * Every root-level and top-level docs markdown file must be registered in
 * doc-drift.md, and every non-glob path registered there must exist. A doc
 * nobody registered is a doc nobody sweeps when the code moves.
 */
async function checkLivingStateRegistry(): Promise<void> {
	checksRun++;
	const rulePath = join(ROOT, '.agents/rules/doc-drift.md');
	if (!await exists(rulePath)) {
		fail('living-state', '.agents/rules/doc-drift.md', 'missing; it owns the living-state registry');
		return;
	}
	const text = await readText(rulePath);
	const section = text.split('## Generated Surfaces')[0]!;
	const listed = [...section.matchAll(/^- `([^`]+)`$/gm)].map((m) => m[1]!);
	if (listed.length === 0) {
		fail('living-state', '.agents/rules/doc-drift.md', 'no registry entries found under Living-State Surfaces');
		return;
	}

	const globs = listed.filter((p) => p.includes('*'));
	const concrete = listed.filter((p) => !p.includes('*'));

	// Every concrete registered path exists.
	for (const path of concrete) {
		if (!await exists(join(ROOT, path))) {
			fail('living-state', '.agents/rules/doc-drift.md', `registers \`${path}\`, which does not exist`);
		}
	}

	const covered = (path: string): boolean => {
		if (concrete.includes(path)) return true;
		return globs.some((g) => path.startsWith(g.replace(/\*+$/, '')));
	};

	// Every root-level and top-level docs markdown file is registered.
	const mustRegister: string[] = [];
	for await (const entry of Deno.readDir(ROOT)) {
		if (entry.isFile && entry.name.endsWith('.md')) mustRegister.push(entry.name);
	}
	for await (const entry of Deno.readDir(join(ROOT, 'docs'))) {
		if (entry.isFile && entry.name.endsWith('.md')) mustRegister.push(`docs/${entry.name}`);
	}
	for (const path of mustRegister) {
		if (path in GENERATED_FILES) continue; // generated files have their own table
		if (!covered(path)) {
			fail(
				'living-state',
				path,
				'not registered in the Living-State Surfaces list of .agents/rules/doc-drift.md',
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: relative links resolve
// ---------------------------------------------------------------------------

/** Turn a Markdown heading into the anchor slug GitHub would generate. */
function headingSlug(heading: string): string {
	return heading
		.trim()
		.toLowerCase()
		.replace(/`[^`]*`/g, (s) => s.slice(1, -1))
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-');
}

async function anchorsOf(path: string): Promise<Set<string>> {
	const text = await readText(path);
	const slugs = new Set<string>();
	for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) slugs.add(headingSlug(match[1]!));
	// Explicit anchor targets authors sometimes add by hand.
	for (const match of text.matchAll(/<a\s+(?:id|name)="([^"]+)"/g)) slugs.add(match[1]!);
	return slugs;
}

/**
 * A link that 404s teaches an agent that the path it names exists. A link whose
 * `#fragment` does not resolve is the same failure one level down: the file
 * opens, the section it promised is gone, and a rule that cited a specific
 * section now cites the whole document.
 */
async function checkRelativeLinks(files: string[]): Promise<void> {
	checksRun++;
	const anchorCache = new Map<string, Set<string>>();

	for (const file of files) {
		const text = await readText(file);
		for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
			const raw = match[1]!.trim();
			if (/^(https?:|mailto:|data:|<)/.test(raw)) continue;
			const [targetRaw, fragment] = raw.split('#');
			const where = `${rel(file)}:${lineOf(text, match.index!)}`;

			// A bare "#anchor" points within the same file.
			const resolved = targetRaw ? normalize(join(dirname(file), decodeURIComponent(targetRaw))) : file;
			if (targetRaw && !await exists(resolved)) {
				fail('links', where, `link target does not exist: ${raw}`);
				continue;
			}
			if (!fragment || !resolved.endsWith('.md')) continue;

			if (!anchorCache.has(resolved)) anchorCache.set(resolved, await anchorsOf(resolved));
			if (!anchorCache.get(resolved)!.has(fragment.toLowerCase())) {
				fail('links', where, `no heading matches the anchor "#${fragment}" in ${rel(resolved)}`);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: documented deno tasks exist
// ---------------------------------------------------------------------------

/**
 * A documented command that is not a real task sends an agent down a path that
 * ends in an error, and it is the single most common form of command drift
 * here because the command surface is repeated in several documents.
 */
async function checkDocumentedTasks(files: string[]): Promise<void> {
	checksRun++;
	const denoJson = JSON.parse(await readText(join(ROOT, 'deno.json')));
	const tasks = new Set(Object.keys(denoJson.tasks ?? {}));

	for (const file of files) {
		const text = await readText(file);
		for (const match of text.matchAll(/\bdeno task ([a-z][a-z0-9:-]*)/g)) {
			const name = match[1]!;
			if (!tasks.has(name)) {
				fail(
					'documented-tasks',
					`${rel(file)}:${lineOf(text, match.index!)}`,
					`documents \`deno task ${name}\`, which is not defined in deno.json`,
				);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: workspace paths named in scripts exist
// ---------------------------------------------------------------------------

/**
 * A script that watches a renamed directory fails silently forever. This is not
 * hypothetical: sync-docs.ts watched `spandex-testing/src/axioms/` while the
 * real directory was `axiom/`, so its test-change detection never fired.
 */
async function checkScriptPaths(): Promise<void> {
	checksRun++;
	for await (const entry of walk(join(ROOT, 'scripts'), { exts: ['.ts'] })) {
		const text = await readText(entry.path);
		for (const match of text.matchAll(/['"`](packages\/@[a-z]+\/[A-Za-z0-9@._/-]+)['"`]/g)) {
			const path = match[1]!.replace(/\/$/, '');
			if (path.includes('${')) continue;
			if (!await exists(join(ROOT, path))) {
				fail(
					'script-paths',
					`${rel(entry.path)}:${lineOf(text, match.index!)}`,
					`names workspace path "${path}", which does not exist`,
				);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: repository paths named in prose exist
// ---------------------------------------------------------------------------

/**
 * A path in a code span is a claim that the path exists, and it is the claim
 * that rots hardest: nothing resolves it, so a rename leaves every mention
 * behind. This is what let a subagent definition go on naming three
 * implementations that had been archived, one of them as "current production".
 *
 * Scoped to living-state and scaffolding surfaces. Historical records under
 * `archive/` and `docs/analyses/` name what existed when they were written, and
 * that is correct.
 */
async function checkNamedPaths(files: string[]): Promise<void> {
	checksRun++;
	// Documentation templates name a path the reader is meant to substitute.
	// A bracketed or angled segment, a `your-` prefix, and a bare single-letter
	// segment are the three spellings this repository uses for that.
	const placeholder =
		/[\[\]<>*${}]|(?:^|\/)your-|(?:^|\/)[A-Z](?:\.[a-z]+)?(?:\/|$)|\bnewimpl\b|\bmyimpl\b|\bexample\b|\bfoo\b/i;
	const roots = ['packages/', 'docs/', 'scripts/', 'benchmarks/', 'archive/', 'site/', '.agents/', '.github/'];

	for (const file of files) {
		const relPath = rel(file);
		if (relPath.startsWith('archive/') || relPath.startsWith('docs/analyses/')) continue;
		if (relPath in GENERATED_FILES) continue;
		const text = await readText(file);

		for (const match of text.matchAll(/`([A-Za-z0-9@._/-]+\.(?:ts|md|json|css|yml)|[A-Za-z0-9@._/-]+\/)`/g)) {
			const path = match[1]!;
			if (placeholder.test(path)) continue;
			// Archived implementation code lives in git history by design, so
			// `archive/src/**` is absent until someone restores it. Documenting
			// that path is correct; requiring it to exist would be wrong.
			if (path.startsWith('archive/src/')) continue;
			if (!roots.some((r) => path.startsWith(r))) continue;
			if (await exists(join(ROOT, path))) continue;
			fail(
				'named-paths',
				`${relPath}:${lineOf(text, match.index!)}`,
				`names \`${path}\`, which does not exist`,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: generated files keep their banner
// ---------------------------------------------------------------------------

/** The banner is the only thing telling a reader their edit will be lost. */
async function checkGeneratedBanners(): Promise<void> {
	checksRun++;
	for (const [file, generator] of Object.entries(GENERATED_FILES)) {
		const path = join(ROOT, file);
		if (!await exists(path)) {
			fail('generated-banner', file, 'declared generated but does not exist');
			continue;
		}
		const head = (await readText(path)).slice(0, 400);
		if (!head.includes('GENERATED FILE - DO NOT EDIT MANUALLY')) {
			fail('generated-banner', file, 'is generated but has lost its DO NOT EDIT banner');
		}
		if (!head.includes(generator)) {
			fail('generated-banner', file, `banner does not name its generator (${generator})`);
		}
	}
}

// ---------------------------------------------------------------------------
// Check: no hardcoded implementation counts
// ---------------------------------------------------------------------------

/**
 * "Active implementations (3)" is wrong the day a fourth lands, and nothing
 * fails when it does. The directory is the source of truth; docs point at it.
 */
async function checkHardcodedCounts(files: string[]): Promise<void> {
	checksRun++;
	const patterns: Array<[RegExp, string]> = [
		[
			/\b(?:active\s+)?implementations?\**\s*\(\s*\d+\s*(?:total)?\s*\)/gi,
			'hardcoded implementation count',
		],
		[
			/\b\d+\s+active\s+implementations?\b/gi,
			'hardcoded implementation count',
		],
		[
			/\ball\s+(?:three|four|five|six|seven|eight|nine|ten)\s+implementations?\b/gi,
			'hardcoded implementation count',
		],
	];

	for (const file of files) {
		const relPath = rel(file);
		if (relPath in GENERATED_FILES) continue; // generated from the directory, so it cannot drift
		if (relPath.startsWith('docs/analyses/') || relPath.startsWith('archive/')) continue; // historical
		const text = proseOnly(await readText(file));
		for (const [pattern, label] of patterns) {
			for (const match of text.matchAll(pattern)) {
				fail(
					'hardcoded-counts',
					`${relPath}:${lineOf(text, match.index!)}`,
					`${label}: "${match[0]!.trim()}" — describe the set and point at packages/@jim/spandex/src/index/`,
				);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: prose bans from doc-voice.md
// ---------------------------------------------------------------------------

/**
 * The high-signal regressions only. Each ban here replaced a sentence of prose
 * that asked an agent to remember the same thing.
 */
async function checkProseBans(files: string[]): Promise<void> {
	checksRun++;

	for (const file of files) {
		const relPath = rel(file);
		if (relPath in GENERATED_FILES) continue;
		if (relPath.startsWith('archive/')) continue; // historical record, left as written
		const raw = await readText(file);
		const text = proseOnly(raw);
		const isRule = relPath.startsWith('.agents/');

		// `deno fmt` rewrites `**R*` into `__R_`, which renders as italic and
		// corrupts the algorithm name. Plain `R*` is always safe.
		for (const match of text.matchAll(/\*\*R\*|__R_(?=[\s_])/g)) {
			fail(
				'prose',
				`${relPath}:${lineOf(text, match.index!)}`,
				'bolded R* breaks under `deno fmt` and renders as italic — write plain R*',
			);
		}

		// rustdoc intra-doc link syntax; nothing here resolves it.
		for (const match of raw.matchAll(/\[`[^`\]]+`\](?!\(|\[|:)/g)) {
			fail(
				'prose',
				`${relPath}:${lineOf(raw, match.index!)}`,
				`bracketed code span with no link target: ${match[0]} — write the plain code span or a real link`,
			);
		}

		// The two em-dash spellings habit reaches for most.
		for (const match of text.matchAll(/—\s+(which|and then)\b/g)) {
			fail(
				'prose',
				`${relPath}:${lineOf(text, match.index!)}`,
				`habitual em-dash: "— ${match[1]}" — a comma or a new sentence carries this`,
			);
		}

		// A sentence past this length has lost the reader well before the period.
		for (const match of text.matchAll(/[^.!?\n|]{251,}[.!?]/g)) {
			const line = lineOf(text, match.index!);
			const snippet = match[0]!.trim().slice(0, 60).replace(/\s+/g, ' ');
			fail(
				'prose',
				`${relPath}:${line}`,
				`sentence runs ${match[0]!.trim().length} characters (limit 250): "${snippet}…"`,
			);
		}

		// Agent scaffolding must not leak into human first-read pages.
		if (!isRule && relPath !== 'CONTRIBUTING.md' && relPath !== 'CLAUDE.md') {
			if (HUMAN_PREFIXES.some((p) => relPath === p || relPath.startsWith(p))) {
				for (const match of raw.matchAll(/\]\([^)]*\.agents\//g)) {
					fail(
						'prose',
						`${relPath}:${lineOf(raw, match.index!)}`,
						'human first-read page links into .agents/ — route readers to docs/ instead',
					);
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Check: CLAUDE.md stays a routing table
// ---------------------------------------------------------------------------

/**
 * CLAUDE.md loads in full every session, so it is the surface the token budget
 * binds hardest. Procedure belongs in a skill and constraint belongs in a rule.
 */
async function checkEntryPointBudget(): Promise<void> {
	checksRun++;
	const LIMIT = 200;
	const path = join(ROOT, 'CLAUDE.md');
	const lines = (await readText(path)).split('\n').length;
	if (lines > LIMIT) {
		fail(
			'entry-point-budget',
			'CLAUDE.md',
			`is ${lines} lines (limit ${LIMIT}). It loads every session: move procedure into a skill and constraint into a rule under .agents/.`,
		);
	}
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const files = await ownedMarkdown();

	await checkOverlaySymlinks();
	await checkIndexParity();
	await checkSkillFrontmatter();
	await checkAgentFrontmatter();
	await checkLivingStateRegistry();
	await checkRelativeLinks(files);
	await checkDocumentedTasks(files);
	await checkScriptPaths();
	await checkNamedPaths(files);
	await checkGeneratedBanners();
	await checkHardcodedCounts(files);
	await checkProseBans(files);
	await checkEntryPointBudget();

	if (failures.length === 0) {
		console.log(`✅ meta-check: ${checksRun} checks passed over ${files.length} markdown files`);
		return;
	}

	const byCheck = new Map<string, Failure[]>();
	for (const failure of failures) {
		const list = byCheck.get(failure.check) ?? [];
		list.push(failure);
		byCheck.set(failure.check, list);
	}

	console.error(`❌ meta-check: ${failures.length} failure(s)\n`);
	for (const [check, list] of byCheck) {
		console.error(`  ${check} (${list.length})`);
		for (const failure of list) {
			console.error(`    ${failure.where}`);
			console.error(`      ${failure.message}`);
		}
		console.error('');
	}
	Deno.exit(1);
}

await main();
