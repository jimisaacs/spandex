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

// Apply default layout to all markdown files
site.preprocess(['.md'], (pages) => {
	for (const page of pages) {
		page.data.layout ||= 'layout.vto';
		// Use README.md as homepage
		if (page.src.path === '/README') {
			page.data.url = '/';
		}
	}
});

// Convert absolute GitHub URLs to relative paths for JSR package READMEs
site.preprocess(['.md'], (pages) => {
	const githubBase = 'https://github.com/jimisaacs/spandex';
	for (const page of pages) {
		const content = page.data.content as string | undefined;
		if (typeof content === 'string') {
			page.data.content = content.replaceAll(`${githubBase}/blob/main/`, '/');
		}
	}
});

// Copy static assets
site.copy('.nojekyll');
site.copy('./site/_includes/styles.css', 'styles.css');

// Ignore non-documentation directories
site.ignore('archive');
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
