'use strict';

var POLL_INTERVAL = 60 * 1000;
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

module.exports = function (nodecg) {
	var twitchApi = nodecg.extensions['lfg-twitchapi'];
	nodecg.log.info('lfg-twitchapi found, using API polling to augment subscription detection');

	// Poll for subs every POLL_INTERVAL milliseconds
	setInterval(function () {
		twitchApi.get('/channels/{{username}}/subscriptions', {limit: 50, direction: 'desc'},
			function (err, code, body) {
				if (err) {
					nodecg.log.error(err);
					return;
				}

				if (code !== 200) {
					if (code === 401) {
						// We know we are requesting the correct scope, so this error must mean our token expired
						twitchApi.destroySession();
						nodecg.log.error('Token invalid, destroying session and forcing target user to re-login');
					} else {
						nodecg.log.error(body.error, body.message);
					}

					return;
				}

				emitter.emit('gotSubscriptions', body.channel, body.subscriptions);
			});
	}, POLL_INTERVAL);

	return emitter;
};
