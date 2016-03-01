'use strict';

var chat = require('tmi.js');
var hist = require('./history.js');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

function isBroadcaster(user, channel) {
	return user.username === channel;
}

function onSubscription(channel, username, months) {
	var channelNoPound = channel.replace('#', '');
	emitter.emit('subscription', username, channelNoPound, months);
}

module.exports = function (nodecg) {
	var client = new chat.client(nodecg.bundleConfig['tmi.js']);
	var reconnecting = nodecg.Replicant('reconnecting', {
		defaultValue: false,
		persistent: false
	});

	nodecg.listenFor('reconnect', function reconnect() {
		reconnecting.value = true;
		client.disconnect();
		client.connect();
	});

	client.connect();

	client.addListener('connected', function onConnected() {
		reconnecting.value = false;
		nodecg.log.info('Listening for subscribers on ' + nodecg.bundleConfig['tmi.js'].channels.join(', '));
	});

	client.addListener('disconnected', function onDisconnected(reason) {
		nodecg.log.warn('DISCONNECTED: ' + reason);
	});

	client.addListener('reconnect', function onReconnect() {
		reconnecting.value = true;
		nodecg.log.info('Attempting to reconnect...');
	});

	client.addListener('subscription', onSubscription);

	client.addListener('subanniversary', onSubscription);

	client.addListener('chat', function onChat(channel, user, message) {
		var channelNoPound = channel.replace('#', '');
		if (!isBroadcaster(user, channelNoPound)) {
			return;
		}

		var parts = message.split(' ', 2);
		var cmd = parts[0];
		var arg = parts.length > 1 ? parts[1] : null;

		if (!arg) {
			return;
		}

		switch (cmd) {
			case '!sendsub':
				if (hist.exists(arg, channelNoPound)) {
					client.say(channel, 'That username (' + arg + ') appears to be a duplicate. ' +
						'Use !sendsubforce to override.');
					break;
				}
			/* falls through */
			case '!sendsubforce':
				emitter.emit('forcedSubscription', arg, channelNoPound);
				client.say(channel, 'Added ' + arg + ' as a subscriber');
				break;
			default:
			// Do nothing.
		}
	});

	return emitter;
};
