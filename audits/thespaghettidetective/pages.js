export const website = "https://www.thespaghettidetective.com/";
import bootstrapcss from "./proxycontent/bootstrap.min.css.txt";

/**
 * @type {import('../../src/ShopifyPages').ShopifyPages}
 */
export const pages = {
	HomePage: {
		checker: (/** @type {string} */ url) => true,
		optimizations: [
			{
				targets: [],
				changes: [
					{
						// TODO: Add a way to add JavaScript breakpoint anywhere in HTML
						// TODO: Description might be automatically generated from functions being called
						replace() {
							return [
								this.addHtmlAtStartOf(`<style>section,footer{content-visibility: auto}</style>`, 'head'),
								this.getReplaceCommand('gradient-bg', 'graddient-bg')
							];
						},
						description: "Avoid painting and layout for below the fold elements",
					},
					{
						replace() {
							return [
								this.disableResources(["https://www.googleoptimize", 'https://www.googletagmanager.com/gtm.js']),
								this.changeResourcePath('https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta3/dist/css/bootstrap.min.css', '/__perfproxy/bootstrap.min.css'),
								this.getReplaceCommand('class="loadingLazyIframe"', '')
							];
						},
						description: 'Disable Google Optimize and GTM'
					},
					{
						replace() {
							return [
								this.changeResourcePath('https://cdn.jsdelivr.net/npm/bootstrap@5.0.0-beta3/dist/css/bootstrap.min.css', '/__perfproxy/bootstrap.min.css'),
							];
						},
						description: 'Serve bootstrap from same HTTP2 connection'
					},
					{
						replace() {
							return [this.getReplaceCommand('class="loadingLazyIframe"', '')];
						},
						implementation: {
							suggestion: 'LazyLoad it properly. Currently Lazy load for it is not working',
							effort: 'Medium'
						},
						description: 'Disable YouTube Video'
					}
				],
			}
		]
	}
}


export const auditConfig = {
	routes: [
		{
			path: "/bootstrap.min.css",
			response: {
				headers: {
					"content-type": "text/css",
				},
				content: bootstrapcss,
			},
		},
	],
	pages,
	website
};
