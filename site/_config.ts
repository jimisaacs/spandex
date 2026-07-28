import lume from 'lume/mod.ts';
import nav from 'lume/plugins/nav.ts';
import prism from 'lume/plugins/prism.ts';
import resolveUrls from 'lume/plugins/resolve_urls.ts';
import sitemap from 'lume/plugins/sitemap.ts';

// Load additional Prism languages (markup, css, clike, javascript included by default)
import 'prism/bash';
import 'prism/typescript';

const site = lume({
	src: '..',
	dest: '../_site',
	includes: './site/_includes',
	location: new URL('https://jimisaacs.github.io/spandex/'),
	prettyUrls: false, // .html extensions preserve relative link semantics
});

site.preprocess(['.md'], (pages) => {
	const githubBase = 'https://github.com/jimisaacs/spandex';
	for (const page of pages) {
		// Convert absolute GitHub URLs to site-relative paths for the built site
		// (source files keep GitHub URLs for JSR, but built site needs full paths)
		const content = page.data.content as string | undefined;
		if (typeof content === 'string') {
			page.data.content = content.replaceAll(`${githubBase}/blob/main/`, '/');
		}
		// Apply default layout to all markdown files
		page.data.layout ||= 'layout.vto';
		// Use README.md as homepage (but keep at root of _site/)
		if (page.src.path === '/README') {
			page.data.url = '/';
		}
	}
});

// Copy static assets
site.copy('.nojekyll');
site.copy('./site/_includes/styles.css', 'styles.css');

// Ignore non-documentation directories
site.ignore('archive/docs/experiments');
site.ignore('benchmarks');
site.ignore('scripts');
site.ignore('site');
site.ignore('.temp');
site.ignore('.git*');

// Ignore internal packages and the core package's tests. The two renderer
// packages keep their fixtures published: the nav links to them as the HTML and
// ASCII examples, since a rendered snapshot is the clearest thing to show for a
// rendering package.
site.ignore('packages/@local');
site.ignore('packages/@jim/spandex/test');

// Ignore agent scaffolding. These are written for an executor, not a reader,
// and a bare filename does not match a `**/` glob, so each is named twice.
site.ignore('AGENTS.md', '**/AGENTS.md');
site.ignore('CLAUDE.md', '**/CLAUDE.md');

// Plugins
//
// No bundled theme. Every prebuilt Prism theme hardcodes its own background, so
// fenced code stayed dark on a light page while plain <pre> followed the
// reader's setting. Token colours live in styles.css and follow the scheme.
site.use(prism());
site.use(nav());
site.use(sitemap());
site.use(resolveUrls());

export default site;
