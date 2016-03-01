'use strict';

var EventEmitter = require('events');
var hist = require('./history.js');

module.exports = function (nodecg) {
	var emitter = new EventEmitter();

	// Only start tmi.js if there are channels to listen to
	if (nodecg.bundleConfig['tmi.js'] && nodecg.bundleConfig['tmi.js'].channels.length > 0) {
		var ircListener = require('./irc_listener')(nodecg);

		ircListener.on('subscription', function (username, channel, months) {
			if (!hist.exists(username, channel, months)) {
				emitter.acceptSubscription(username, channel, months);
			}
		});

		ircListener.on('forcedSubscription', function (username, channel, months) {
			emitter.acceptSubscription(username, channel, months);
		});
	}

	// If lfg-twitchapi and an appropriate config are present, set up polling
	if (nodecg.extensions.hasOwnProperty('lfg-twitchapi')) {
		if (nodecg.config.login.twitch.scope.split(' ').indexOf('channel_subscriptions') < 0) {
			nodecg.log.error('lfg-twitchapi found, but the current NodeCG config lacks the "channel_subscriptions" ' +
				'scope. As a result, Twitch API polling for new subs will be disabled.');
		} else {
			var apiPoller = require('./api_poller')(nodecg);
			apiPoller.on('gotSubscriptions', function (channel, subscriptions) {
				// Go through subs in reverse, from oldest to newest
				subscriptions.reverse().forEach(function (subscription) {
					var username = subscription.user.name;
					if (!hist.exists(username, channel)) {
						emitter.acceptSubscription(username, channel);
					}
				});
			});
		}
	} else {
		nodecg.log.warn('lfg-twitchapi not present, API polling will not be available');
	}

	/**
	 * Emits a 'subscription' event and adds it to the history.
	 * @params {string} username
	 * @params {string} channel
	 * @params {integer} months
	 */
	emitter.acceptSubscription = function (username, channel, months) {
		var content = {
			name: username,
			resub: Boolean(months),
			channel: channel,
			timestamp: Date.now()
		};

		if (months) {
			content.months = months;
		}

		nodecg.sendMessage('subscription', content);
		emitter.emit('subscription', content);
		hist.add(username, channel, months);
	};

	return emitter;
};
