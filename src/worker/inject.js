//(function(version, versionReadable) { // This code is automatically added before injecting the dist version of this file.
import { getDisabledStatus } from "../utils";
export default function injectPerframeCode() {
	/** @type Record<string, any> */
	const perframe = window.__perframe = window.__perframe || {};

	// @ts-ignore version is provided when this code is injected.
	let _version = version;
	// @ts-ignore versionReadable is provided when this code is injected.
	let _versionReadable = versionReadable;

	perframe.contentVersion = _version;
	perframe.contentVersionReadable = _versionReadable

	perframe.toggleDetailedView = function () {
		let statusEl = perframe.statusEl;
		let el = statusEl && statusEl.querySelector('#perframe-status-detailed');

		if (!el || !statusEl) { return; }
		if (el.style.display === 'none') {
			el.style.display = 'block'
			statusEl.style.bottom = '0';
		} else {
			el.style.display = 'none';
			statusEl.style.bottom = 'auto';
		}
		return false
	}

	function setupUIAndAutoUpdate() {
		try {
			(function () {
				var newVersionAvailable = false;
				let upComingVersion = 0;
				/**
				 * @type WebSocket
				 */
				let socket;

				function checkUpcomingVersion() {
					var html = `Version: ${perframe.contentVersionReadable}. 
						<span style=" position:relative;float:right">
							<a href="javascript:void(0)" style="color:white; text-decoration:auto;" onclick="__perframe.statusEl.style.display = 'none';return false">Close</a> 
							<a href="javascript:void(0)" style="color:white; text-decoration:auto;" onclick="__perframe.toggleDetailedView()">Min/Max</a>
						</span>
					<div id="perframe-status-detailed" style="display:none">
						<ol style="list-style:decimal; margin-block-start:1em; margin-block-end: 1em;padding-inline-start: 40px">`;
					perframe.optimizations.forEach(function (/**@type import("../ShopifyPages").Optimization*/optimization) {
						optimization.changes.forEach(function (change) {
							let status = getDisabledStatus(change, new URL(document.URL));
							if (change.failedToApply) {
								console.error('Perframe:', change.failedToApply)
							}
							html += '<li style="padding:5px; list-style-type:decimal"> ' +
								(status ? (`<span style="color:yellow">${status == 2 ? '[Dynamically DISABLED]' : '[DISABLED]'} </span>`) : status === 0 ? `<span style="color:yellow">[Dynamically Enabled]${change.failedToApply ? '[Error Applying]' : ''}</span>` : `${change.failedToApply ? '<span style="color:red">[Error Applying]</span>' : ''}`) +
								(change.breaking ? `<span style="color:blue">[BREAKING] </span>` : '') +
								change.description +
								(change.disabled ? `<div>Disabled Reason: ${change.disabledReason}</div>` : '') +
								'</li>'
						});
					})

					html += `	</ol>
						<div style="color:yellow">
							<ul>
								<li><i>Disable changes using query param <strong>__perframe_disable_changes=CHANGE_NUMBER1,CHANGE_NUMBER2</strong></i></li>
								<li><i>Enable changes using query param <strong>__perframe_enable_changes=CHANGE_NUMBER1,CHANGE_NUMBER2</strong></i></li>
								<li><i>Apply only the given changes using query param <strong>__perframe_only_changes=CHANGE_NUMBER1,CHANGE_NUMBER2</strong></i></li>
								<li><i>Disable all breaking changes using <strong>__perframe_disable_all_breaking_changes</strong></i></li>
								<li>Access audit report  <a style="color:white" target="_blank" href="/__perfproxyReport">Here</a></li>
							</ul>
						</div>
					</div>`

					if (upComingVersion > perframe.contentVersion) {
						newVersionAvailable = true;
						console.log('Perframe-Client: New Version available');
						html = '<div style=background:red>Updating</div>'
						perframe.registration.update()
						let attemptCounter = 0;

						// HACK: Due to some reason doing an update() does not work, so keep trying it which works.
						setInterval(function () {
							// Keep trying again just in case
							perframe.registration.update()
							attemptCounter++;
						}, 1000);

						if (attemptCounter > 5) {
							location.reload();
						}

						socket.close();
					}

					let shadowHost = document.getElementById('perfproxy-status');
					if (shadowHost) {
						shadowHost.innerHTML = html;
						return;
					}

					shadowHost = document.createElement('div');
					shadowHost.id = 'perfproxy-status'

					let statusElShadowRoot = shadowHost.attachShadow({ mode: 'open' });
					let statusEl = perframe.statusEl = document.createElement('div');
					statusElShadowRoot.appendChild(statusEl);

					statusEl.id = ""
					statusEl.style.position = 'fixed';
					statusEl.style.top = '0';
					statusEl.style.right = '0';
					statusEl.style.left = '0';
					statusEl.style.background = 'darksalmon';
					statusEl.style.color = 'white';
					statusEl.style.padding = '5px';
					statusEl.style.zIndex = '100000000000'
					statusEl.style.fontSize = '20px';
					statusEl.style.overflow = 'scroll';
					statusEl.innerHTML = html;
					if (!(new URL(document.URL)).searchParams.get('__perframe_ui')) {
						statusEl.style.display = 'none'
					}
					document.body.appendChild(shadowHost)
				}

				function intializeWebSocket() {
					socket = new WebSocket('ws://127.0.0.1:9091', 'version');
					socket.onmessage = function (e) {
						upComingVersion = e.data;
						checkUpcomingVersion();
					};
					socket.onclose = function (e) {
						console.log('Perframe-Client: socket closed', 'code:', e.code, 'reason:', e.reason);
						if (newVersionAvailable) { return }
						setTimeout(intializeWebSocket, 500);
					}
				}
				if (document.domain === '127.0.0.1') {
					intializeWebSocket();
				} else {
					checkUpcomingVersion();
				}

			})();
		} catch (e) {
			console.log('Perframe-Client: ', e);
			if (document.domain === '127.0.0.1') {
				console.log('Perframe-Client: Retrying SW Update')
				perframe.registration.update().then(function () {
					location.reload();
				})
			}
		}
	}

	if (document.domain === '127.0.0.1') {
		navigator.serviceWorker.register('/worker.js').then(reg => {
			navigator.serviceWorker.ready.then(() => {
				perframe.registration = reg;
			});
		});

		navigator.serviceWorker.addEventListener('controllerchange', function () {
			location.reload();
		});
	}

	fetch('/__perfproxyAuditConfig?u=' + document.URL).then(function (resp) {
		return resp.json();
	}).then(function (config) {
		perframe.optimizations = config.optimizations;
		setupUIAndAutoUpdate();
	});
}
injectPerframeCode();