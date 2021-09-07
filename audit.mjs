#!/usr/bin/env zx
/* eslint-disable no-tabs */
import fs from 'node:fs';
import minimist from 'minimist';

/** @type Record<thirdParty|lighthouseTest|PSITests: any> */
const flags = minimist(process.argv.slice(2));
const key = 'AIzaSyCTbtKPZqZbUjNka6sX_Bt6vl9YcR_H9bw';
const availableFlags = ['thirdParty', 'lighthouseTest', 'PSITests', 'url'];
const url = flags.url;
if (process.argv.length < 4) {
	console.log(`
Usage: Flags Available. Atleast 1 flag is required.
thirdParty: Print Third Party Domains.
url: URL of the page
lighthouseTest: Run lighthouse test that would update lighthouse-latest.json which is used to compute Third Party Domains.
PSITests: Runs PSI Tests for all the changes 1 by 1.
`)
	process.exit(0);
}
Object.keys(flags).forEach(flag => {
	if (flag === '_' || flag === '__') {
		return;
	}
	if (!availableFlags.includes(flag)) {
		throw new Error('Unknown Flag:' + flag);
	}
});
if (flags.lighthouseTest) {
	let PSIScore = await $`./node_modules/.bin/lighthouse ${url}  --output json --output-path ./lighthouse-latest.json  --only-categories="performance" --chrome-flags="--headless"  > /dev/null 2>&1  && ./node_modules/node-jq/bin/jq ".categories.performance.score" lighthouse-latest.json`;

	console.log('PSI Score is:', PSIScore.stdout);
}
if (flags.thirdParty) {
	const report = JSON.parse(fs.readFileSync('lighthouse-latest.json'));
	const networkRequests = report.audits['network-requests'].details.items;
	const uniqueDomains = new Set();
	const pageUrl = new URL(report.finalUrl);
	networkRequests.forEach((req) => {
		const { url } = req;
		const parsedUrl = new URL(url);
		if (!parsedUrl.hostname) {
			// console.error('Can\'t determine domain for', url);
			return;
		}
		if (pageUrl.hostname === parsedUrl.hostname) {
			return;
		}
		uniqueDomains.add(parsedUrl.hostname);
	});
	let domains = [];
	for (var domain of uniqueDomains.values()) {
		domains.push(domain);
	}
	console.log('Following are the list of Third-Party-Domains present on the page', domains);
}

if (flags.PSITests) {
	const promises = [];
	for (let i = -1; i <= 11; i++) {
		const parsedUrl = new URL(url);

		// Keep the first test without Optimizations
		if (i > 0) {
			parsedUrl.searchParams.set('__optimization', '1');
			parsedUrl.searchParams.set('__perframe_only_changes', i);
		}

		if (i === -1) {
			parsedUrl.searchParams.set('__optimization', '1');
		}

		const urlWithGivenChange = encodeURIComponent(parsedUrl.toString());
		(function closureChangeId(changeId) {
			const psiTestUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&url=${urlWithGivenChange}&key=${key}`;
			const reportWrapper = fetch(psiTestUrl)
				.then((resp) => {
					if (resp.status !== 200) {
						throw new Error(`Request failed:${resp.statusText}`);
					}
					return resp.json();
				}).then((psiResult) => ({
					psiResult,
					url: urlWithGivenChange,
					changeId
				}));
			promises.push(reportWrapper);
		}(i));
	}

	const auditReport = {
		changes: {}
	};

	Promise.all(promises).then((reportsWrappers) => {
		reportsWrappers.forEach((reportWrapper) => {
			auditReport.changes[reportWrapper.changeId] = {
				url: reportWrapper.url,
				score: reportWrapper.psiResult.lighthouseResult.categories.performance.score
			};
			fs.writeFileSync(`./auto-audits/${reportWrapper.changeId}.json`, JSON.stringify(reportWrapper.psiResult.lighthouseResult));
		});
		console.log(auditReport);
	});
}
