import fs from 'node:fs'
import chalk from 'chalk'
import toml from '@iarna/toml';
import path from 'node:path'
import osascript from 'node-osascript';

const AUDIT = process.env.AUDIT
const WRANGLE_CONFIG_PATH = path.join('.', 'wrangler.toml')

if (!AUDIT) {
	console.log(chalk.red("Please set the AUDIT env variable."))
	process.exit(1)
}

const tomlContent = fs.readFileSync(WRANGLE_CONFIG_PATH).toString()
let wranglerConfig
try {
	wranglerConfig = toml.parse(tomlContent);
} catch (e) {
	console.log(chalk.red(`Error parsing wrangler config: ${e}`))
	process.exit(1)
}

if (!wranglerConfig.env || !wranglerConfig.env[AUDIT]) {
	wranglerConfig.env = wranglerConfig.env || {};
	wranglerConfig.env[AUDIT] = {
		name: `${AUDIT}-perfproxy`,
		kv_namespaces: wranglerConfig.kv_namespaces
	}
	fs.writeFileSync(WRANGLE_CONFIG_PATH, toml.stringify(wranglerConfig))
}

const MAX_RETRY = 5; // seconds
const fetch = require("node-fetch");
const versionReadable = new Date().toString();
const version = Date.now();
let keysDetailsList = await $`wrangler kv:key list --binding=HTML_CACHE --env ${AUDIT}`
let deletionConfig = [];

JSON.parse(keysDetailsList).forEach((keysDetails) => {
	deletionConfig.push({ key: keysDetails.name, value: '' })
});

fs.writeFileSync('.tmp-deletion-config-wrangler', JSON.stringify(deletionConfig));
try {
	await $`yes|wrangler kv:bulk delete --binding=HTML_CACHE .tmp-deletion-config-wrangler --env ${AUDIT}`
} catch (e) {
	// Due to Some reason, successful deletion throws error 141, so we ignore it
	if (e.exitCode !== 141) {
		throw (e)
	}
}
await $`rm -f .tmp-deletion-config-wrangler`
await $`./node_modules/.bin/webpack`
fs.writeFileSync('version.json', JSON.stringify({ '//': 'Auto Generated File', version, versionReadable }));
await $`VERSION=${version} VERSION_READABLE=${versionReadable} ./node_modules/@cloudflare/wrangler/run-wrangler.js publish --env ${AUDIT}`

async function ensureVersion(version) {
	const response = await fetch(`https://${AUDIT}-perfproxy.hariombalhara.workers.dev/__perfproxyVersion`);
	const versionDetails = await response.json();
	return versionDetails.version == version;
}

console.log(chalk.yellow('Changes Published. Waiting for them to be available for testing.'));

let errorTimeoutStarted = false;
const interval = setInterval(async function () {
	try {
		var isVersionLive = await ensureVersion(version);
		errorTimeoutStarted = false;
	} catch (e) {
		console.error(chalk.red(`Error in verifying version. Will retry for a total of ${MAX_RETRY} seconds`), e);
		if (errorTimeoutStarted) {
			return;
		}
		//Give Max 5 seconds in case of error
		setTimeout(function () {
			clearInterval(interval);
		}, MAX_RETRY * 1000);
		errorTimeoutStarted = true;
	}

	if (isVersionLive) {
		let msg = `Live: Version ${versionReadable}`
		console.log(chalk.green(msg));
		try {
			await $`afplay /System/Library/Sounds/Funk.aiff`
			await new Promise((resolve) => {
				osascript.execute(`display notification "${msg}"`, () => {
					resolve();
				})
			})
		} catch (e) {
			console.log('Couldn\'t notify through Apple Notifications. Tweak the audio if needed');
		}
		clearInterval(interval);
	}
}, 1000);

