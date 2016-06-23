'use strict';

const chat = require('tmi.js');
const hist = require('./history.js');
const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

function isBroadcaster(user, channel) {
	return user.username === channel;
}

function onSubscription(channel, username, months) {
	const channelNoPound = channel.replace('#', '');
	emitter.emit('subscription', username, channelNoPound, months);
}

module.exports = function (nodecg) {
	const client = new chat.client(nodecg.bundleConfig['tmi.js']);
	const reconnecting = nodecg.Replicant('reconnecting', {
		defaultValue: false,
		persistent: false
	});

	nodecg.listenFor('reconnect', () => {
		reconnecting.value = true;
		client.disconnect();
		client.connect();
	});

	client.connect();

	client.addListener('connected', () => {
		reconnecting.value = false;
		nodecg.log.info(`Listening for subscribers on ${nodecg.bundleConfig['tmi.js'].channels.join(', ')}`);
	});

	client.addListener('disconnected', reason => {
		nodecg.log.warn(`DISCONNECTED: ${reason}`);
	});

	client.addListener('reconnect', () => {
		reconnecting.value = true;
		nodecg.log.info('Attempting to reconnect...');
	});

	client.addListener('subscription', onSubscription);

	client.addListener('resub', onSubscription);

	client.addListener('chat', (channel, user, message) => {
		const channelNoPound = channel.replace('#', '');
		if (!isBroadcaster(user, channelNoPound)) {
			return;
		}

		const parts = message.split(' ', 2);
		const cmd = parts[0];
		const arg = parts.length > 1 ? parts[1] : null;

		if (!arg) {
			return;
		}

		switch (cmd) {
			case '!sendsub':
				if (hist.exists(arg, channelNoPound)) {
					client.say(channel, `That username (${arg}) appears to be a duplicate. ` +
						'Use !sendsubforce to override.');
					break;
				}
			/* falls through */
			case '!sendsubforce':
				emitter.emit('forcedSubscription', arg, channelNoPound);
				client.say(channel, `Added ${arg} as a subscriber`);
				break;
			default:
			// Do nothing.
		}
	});

	return emitter;
};
