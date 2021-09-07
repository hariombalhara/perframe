//@ts-ignore Audit dir is decided during Webpack build as an environment variable
import { pages, auditConfig, website as givenWebsite } from 'Audit/pages.js';
import { isInServiceWorker } from "../utils";
import { prepareChanges } from '../utils';

// Must not have / in the end.
export const PROXY_CONTENT_PATH = '/__perfproxy';
export const proxyWebsiteRegExp = /https?:\/\/.*-perfproxy\.hariombalhara\.workers\.dev\/|http:\/\/127.0.0.1:9090\//;
// Available from WebPack DefinePlugin
export const version = __VERSION__;
export const versionReadable = __VERSION_READABLE__;
export const WORKER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.106 Safari/537.36'

if (!givenWebsite.endsWith('/')) {
	throw new Error('Website URL must end with /');
} else if (givenWebsite.split('/') > 3) {
	throw new Error(
		'Specify HomePage Path of the website like http://example.com/',
	);
}

export const website = !isInServiceWorker()
	? givenWebsite
	: `http://127.0.0.1:9090/proxy/${encodeURIComponent(givenWebsite)}/`

if (isInServiceWorker()) {
	console.log('Service Worker is running');
	self.HTML_CACHE = {
		//@ts-ignore How to force it to expect a noop
		put() { },
		//@ts-ignore How to force it to expect a noop
		get() { }
	};
}

auditConfig.routes = auditConfig.routes || [];

prepareChanges(pages);
