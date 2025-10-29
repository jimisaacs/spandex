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

// Ignore internal packages and tests
site.ignore('packages/@local');
site.ignore('packages/@jim/spandex/test');

// Ignore AI assistant configuration
site.ignore('CLAUDE.md');
site.ignore('**/.cursorrules');
site.ignore('**/CLAUDE.md');

// Plugins
site.use(
	prism({
		theme: {
			name: 'okaidia', // Dark theme that matches your site
			cssFile: '/styles.css',
			placeholder: '/* prism-theme */',
		},
	}),
);
site.use(nav());
site.use(sitemap());
site.use(resolveUrls());

export default site;
