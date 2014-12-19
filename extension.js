'use strict';

var fs = require('fs'),
    squirrel = require('squirrel'),
    events = require('events'),
    log = require('../../lib/logger/index'),
    History = require('./extension/history'),
    nodecg = {},
    util = require('util');

var history = {};

var Sublistener = function(extensionApi) {
    nodecg = extensionApi;

    if (!Object.keys(nodecg.bundleConfig).length) {
        throw new Error('[lfg-sublistener] No config found in cfg/lfg-sublistener.json, aborting!');
    }

    nodecg.bundleConfig['twitch-irc'].channels.forEach(function(channel) {
        history['#' + channel] = new History();
    });

    events.EventEmitter.call(this);
    var self = this;

    // Lazy-load and lazy-install the twitch-irc npm package if necessary
    squirrel('twitch-irc', function twitchIrcLoaded(err, irc) {
        var client = new irc.client(nodecg.bundleConfig['twitch-irc']);

        client.connect();

        client.addListener('connected', function onConnected(address, port) {
            var msg = '[lfg-sublistener] Listening for subscribers on ' + nodecg.bundleConfig['twitch-irc'].channels;
            log.info(msg);
        });

        client.addListener('disconnected', function onDisconnected(reason) {
            log.warn('[lfg-sublistener] DISCONNECTED:', reason);
        });

        client.addListener('reconnect', function onReconnect() {
            log.info('[lfg-sublistener] Attempting to reconnect...');
        });

        client.addListener('connectfail', function onConnectFail() {
            log.error('[lfg-sublistener] Failed to connect, reached maximum number of retries');
        });

        client.addListener('limitation', function onLimitation(err) {
            log.error('[lfg-sublistener]', err.message);
        });

        client.addListener('subscription', function onSubscription(channel, username) {
            if (!self.isDuplicate(username, channel)) {
                history[channel].add(username);
                self.acceptSubscription(username, channel)
            }
        });

        client.addListener('crash', function onCrash(message, stack) {
            log.error('[lfg-sublistener] CRASH:', stack);
        });

        if (nodecg.bundleConfig.chatevents) {
            log.warn('[lfg-sublistener] Chat events are on, may cause high CPU usage');
            client.addListener('chat', function onChat(channel, user, message) {
                if (!self.isBroadcaster(user, channel) && !self.isModerator(user))
                    return;

                var parts = message.split(' ',2);
                var cmd = parts[0];
                var arg = parts.length > 1 ? parts[1] : null;

                if (!arg)
                    return;

                switch (cmd) {
                    case '!sendsub':
                        if (self.isDuplicate(arg, channel)) {
                            client.say(channel, 'That username, ' + arg + ', appears to be a duplicate. Use !sendsubforce to override.');
                            break;
                        }
                    case '!sendsubforce':
                        history[channel].add(arg);
                        self.acceptSubscription(arg, channel);
                        client.say(channel, 'Added ' + arg + ' as a subscriber');
                        break;
                }
            });
        }
    });
};

// To let another bundle's extension take advantage of sublistener, we must export an event listener.
util.inherits(Sublistener, events.EventEmitter);

Sublistener.prototype.isBroadcaster = function(user, channel) {
    // Remove the leading "#" from channel when comparing
    return user.username === channel.slice(1);
};

Sublistener.prototype.isModerator = function(user) {
    return user.special.indexOf('moderator') >= 0;
};

Sublistener.prototype.isDuplicate = function(username, channel) {
    try {
        return history[channel].find(username) >= 0;
    } catch(e) {
        log.error("[lfg-sublistener] Dupe check failed:", e.stack);
    }
};

Sublistener.prototype.acceptSubscription = function (username, channel) {
    var content = {
        name: username,
        resub: false, //resub not implemented
        channel: channel,
        ts: Date.now() / 1000 // we want seconds, not milliseconds
    };
    nodecg.sendMessage('subscription', content);
    this.emit('subscription', content);
};

module.exports = function(extensionApi) { return new Sublistener(extensionApi); };
