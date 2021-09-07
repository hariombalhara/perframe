/** @type import('../AuditConfig').Routes */
export const internalRoutes = [
	{
		path: "/robots.txt",
		response: {
			content: `User-Agent: *
Disallow: /
`,
		},
	},
	{
		path: "/__perfproxyVersion",
		response: {
			content: (store) => {
				return new Response(`{ "version": ${store.version}}`)
			}
		},
	},
	{
		path: "/__perfproxyAuditConfig",
		response: {
			content: (store) => {
				let responseTxt;
				if (!store.pageType) {
					responseTxt = JSON.stringify({ error: 'pageType cant be determined' });
				} else {
					responseTxt = JSON.stringify(store.auditConfig.pages[store.pageType]);
				}

				return new Response(responseTxt, {
					headers: {
						'content-type': 'application/json'
					}
				})
			}
		},
	},
	{
		path: "/__perfproxyReport",
		response: {
			content: (store) => {
				return new Response(store.reportHtml.replace(/<!--\s*PERFRAME_PAGES_CONFIG_INJECT\s*-->/, `<script>var auditConfig=${JSON.stringify(store.auditConfig, function (key, value) {
					// Don't send changes to report page. They are not required and also breaks the page because of <script> strings present in it
					if (key === 'replace' || key === 'replaceWith') {
						return undefined;
					}
					return value
				}, 2)}</script>`), {
					headers: {
						'content-type': 'text/html'
					}
				})
			}
		},
	},
]

export default internalRoutes;