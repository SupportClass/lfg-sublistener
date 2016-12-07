'use strict';

const server = require('../../../lib/server');
const EventEmitter = require('events');
const hist = require('./history.js');

module.exports = function (nodecg) {
	const emitter = new EventEmitter();

	// Only start tmi.js if there are channels to listen to
	if (nodecg.bundleConfig['tmi.js'] && nodecg.bundleConfig['tmi.js'].channels.length > 0) {
		const ircListener = require('./irc_listener')(nodecg);

		ircListener.on('subscription', (username, channel, months, extra) => {
			if (!hist.exists(username, channel, months)) {
				emitter.acceptSubscription(username, channel, months, extra);
			}
		});

		ircListener.on('forcedSubscription', (username, channel, months) => {
			emitter.acceptSubscription(username, channel, months);
		});
	}

	// If lfg-twitchapi and an appropriate config are present, set up polling
	server.on('extensionsLoaded', () => {
		if ({}.hasOwnProperty.call(nodecg.extensions, 'lfg-twitchapi')) {
			if (nodecg.config.login.twitch.scope.split(' ').indexOf('channel_subscriptions') < 0) {
				nodecg.log.error('lfg-twitchapi found, but the current NodeCG config lacks the' +
					' "channel_subscriptions" scope. As a result, Twitch API polling for new subs will be disabled.');
			} else {
				const apiPoller = require('./api_poller')(nodecg);
				apiPoller.on('gotSubscriptions', (channel, subscriptions) => {
					// Go through subs in reverse, from oldest to newest
					subscriptions.reverse().forEach(subscription => {
						const username = subscription.user.name;
						if (!hist.exists(username, channel)) {
							emitter.acceptSubscription(username, channel);
						}
					});
				});
			}
		} else {
			nodecg.log.warn('lfg-twitchapi not present, API polling will not be available');
		}
	});

	/**
	 * Emits a 'subscription' event and adds it to the history.
	 * @params {string} username
	 * @params {string} channel
	 * @params {integer} [months]
	 * @params {object} [extra]
	 */
	emitter.acceptSubscription = function (username, channel, months, extra = {}) {
		months = parseInt(months, 10);

		const content = {
			name: username,
			resub: months > 1,
			channel,
			timestamp: Date.now(),
			prime: Boolean(extra.prime),
			months
		};

		nodecg.sendMessage('subscription', content);
		emitter.emit('subscription', content);
		hist.add(username, channel, months);
	};

	return emitter;
};
