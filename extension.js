'use strict';

var irc = require('twitch-irc'),
    events = require('events'),
    History = require('./extension/history'),
    nodecg = {},
    util = require('util');

var hist = {};

var Sublistener = function(extensionApi) {
    nodecg = extensionApi;

    if (!Object.keys(nodecg.bundleConfig).length) {
        throw new Error('[lfg-sublistener] No config found in cfg/lfg-sublistener.json, aborting!');
    }

    nodecg.bundleConfig['twitch-irc'].channels.forEach(function(channel) {
        hist['#' + channel] = new History();
    });

    events.EventEmitter.call(this);
    var self = this;
    var client = new irc.client(nodecg.bundleConfig['twitch-irc']);

    nodecg.declareSyncedVar({
        name: 'reconnecting',
        initialVal: false
    });

    nodecg.listenFor('reconnect', function reconnect() {
        nodecg.variables.reconnecting = true;
        client.disconnect();
        client.connect();
    });

    client.connect();
    client.addListener('connected', function onConnected() {
        nodecg.variables.reconnecting = false;
        self.log('info', 'Listening for subscribers on ' + nodecg.bundleConfig['twitch-irc'].channels);
    });

    client.addListener('disconnected', function onDisconnected(reason) {
        self.log('warn', 'DISCONNECTED: ' + reason);
    });

    client.addListener('reconnect', function onReconnect() {
        nodecg.variables.reconnecting = true;
        self.log('info', 'Attempting to reconnect...');
    });

    client.addListener('connectfail', function onConnectFail() {
        self.log('error', 'Failed to connect, reached maximum number of retries');
    });

    client.addListener('limitation', function onLimitation(err) {
        self.log('error', err);
    });

    client.addListener('subscription', function onSubscription(channel, username) {
        if (!self.isDuplicate(username, channel)) {
            hist[channel].add(username);
            self.acceptSubscription(username, channel);
        }
    });

    client.addListener('crash', function onCrash(message, stack) {
        nodecg.log.error('CRASH:', message, '\n\n', stack);
    });

    if (nodecg.bundleConfig.chatevents) {
        nodecg.log.warn('Chat events are on, may cause high CPU usage');
        client.addListener('chat', function onChat(channel, user, message) {
            if (!self.isBroadcaster(user, channel) && !self.isModerator(user))
                return;

            var parts = message.split(' ',2);
            var cmd = parts[0];
            var arg = parts.length > 1 ? parts[1] : null;

            if (!arg) return;

            switch (cmd) {
                case '!sendsub':
                    if (self.isDuplicate(arg, channel)) {
                        client.say(channel, 'That username, ' + arg +
                            ', appears to be a duplicate. Use !sendsubforce to override.');
                        break;
                    }
                    /* falls through */
                case '!sendsubforce':
                    hist[channel].add(arg);
                    self.acceptSubscription(arg, channel);
                    client.say(channel, 'Added ' + arg + ' as a subscriber');
                    break;
            }
        });
    }
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
    var isDupe = false;
    try {
        isDupe = hist[channel].find(username) >= 0;
    } catch(e) {
        nodecg.log.error('Dupe check failed, assuming not a dupe:', e.stack);
    }
    return isDupe;
};

Sublistener.prototype.acceptSubscription = function (username, channel) {
    // 2014-01-15: quick and dirty hack to make sure that we only accept subs
    // that are for one of the channels we are listening to
    var channelNoPound = channel.slice(1);
    if (nodecg.bundleConfig['twitch-irc'].channels.indexOf(channelNoPound) < 0) return;

    var content = {
        name: username,
        resub: false, //resub not implemented
        channel: channel,
        ts: Date.now()
    };
    nodecg.sendMessage('subscription', content);
    this.emit('subscription', content);
};

Sublistener.prototype.log = function (level) {
    var formatArgs = Array.prototype.slice.call(arguments, 1);
    var msg = util.format.apply(this, formatArgs);
    switch (level) {
        case 'info':
            nodecg.log.info(msg); break;
        case 'warn':
            nodecg.log.warn(msg); break;
        case 'error':
            nodecg.log.error(msg); break;
        default:
            return;
    }
    nodecg.sendMessage('log', msg);
};

module.exports = function(extensionApi) { return new Sublistener(extensionApi); };
