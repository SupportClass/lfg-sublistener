'use strict';

var irc = require('twitch-irc');
var hist = require('./history.js');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

function isBroadcaster(user, channel) {
    return user.username === channel;
}

module.exports = function(nodecg, logger) {
    var client = new irc.client(nodecg.bundleConfig['twitch-irc']);
    var reconnecting = nodecg.Replicant('reconnecting', {
        defaultValue: false,
        persistent: false
    });

    nodecg.listenFor('reconnect', function reconnect() {
        reconnecting.value = true;
        client.disconnect();
        client.connect();
    });

    function onSubscription(channel, username, months) {
        var channelNoPound = channel.replace('#', '');
        emitter.emit('subscription', username, channelNoPound, months);
    }

    client.connect();
    client
        .addListener('connected', function onConnected() {
            reconnecting.value = false;
            logger('info', 'Listening for subscribers on ' + nodecg.bundleConfig['twitch-irc'].channels);
        })

        .addListener('disconnected', function onDisconnected(reason) {
            logger('warn', 'DISCONNECTED: ' + reason);
        })

        .addListener('reconnect', function onReconnect() {
            reconnecting.value = true;
            logger('info', 'Attempting to reconnect...');
        })

        .addListener('connectfail', function onConnectFail() {
            logger('error', 'Failed to connect, reached maximum number of retries');
        })

        .addListener('limitation', function onLimitation(err) {
            logger('error', err);
        })

        .addListener('subscription', onSubscription)

        .addListener('subanniversary', onSubscription)

        .addListener('crash', function onCrash(message, stack) {
            nodecg.log.error('CRASH:', message, '\n\n', stack);
        });

    if (nodecg.bundleConfig.chatevents) {
        nodecg.log.warn('Chat events are on, may cause high CPU usage');
        client.addListener('chat', function onChat(channel, user, message) {
            var channelNoPound = channel.replace('#', '');
            if (!isBroadcaster(user, channelNoPound))
                return;

            var parts = message.split(' ',2);
            var cmd = parts[0];
            var arg = parts.length > 1 ? parts[1] : null;

            if (!arg) return;
            switch (cmd) {
                case '!sendsub':
                    if (hist.exists(arg, channelNoPound)) {
                        client.say(channel, 'That username ('+ arg +') appears to be a duplicate. ' +
                            'Use !sendsubforce to override.');
                        break;
                    }
                    /* falls through */
                case '!sendsubforce':
                    emitter.emit('forcedSubscription', arg, channelNoPound);
                    client.say(channel, 'Added ' + arg + ' as a subscriber');
                    break;
            }
        });
    }

    return emitter;
};
