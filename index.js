'use strict';

var fs = require('fs'),
    squirrel = require('squirrel'),
    events = require('events'),
    log = require('../../lib/logger'),
    History = require('./backend/history'),
    nodecg = {},
    util = require('util');

var cfgPath = __dirname + '/config.json';
if (!fs.existsSync(cfgPath)) {
    throw new Error('[eol-sublistener] config.json was not present in bundles/eol-sublistener, aborting');
}
var config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

var history = {};
config['twitch-irc'].channels.forEach(function(channel) {
    history['#' + channel] = new History();
});

var Sublistener = function(extensionApi) {
    if ( Sublistener.prototype._singletonInstance ) {
        return Sublistener.prototype._singletonInstance;
    }
    Sublistener.prototype._singletonInstance = this;

    nodecg = extensionApi;
    var self = this;

    // Lazy-load and lazy-install the twitch-irc npm package if necessary
    squirrel('twitch-irc', function twitchIrcLoaded(err, irc) {
        var client = new irc.client(config['twitch-irc']);

        client.connect();

        client.addListener('connected', function onConnected(address, port) {
            var msg = '[eol-sublistener] Listening for subscribers on ' + config['twitch-irc'].channels;
            log.info(msg);
        });

        client.addListener('disconnected', function onDisconnected(reason) {
            log.warn('[eol-sublistener] DISCONNECTED:', reason);
        });

        client.addListener('connectfail', function () {
            throw new Error("[eol-sublistener] Failed to connect, reached maximum number of retries");
        });

        client.addListener('subscription', function onSubscription(channel, username) {
            if (!self.isDuplicate(arg, channel)) {
                self.acceptSubscription(username)
            }
        });

        client.addListener('subscription', function onSubscription(channel, username) {
            if (!isDuplicate(username, channel)) {
                acceptSubscription(username, channel)
            }
        });

        if (config.chatevents) {
            log.warn('[eol-sublistener] Chat events are on, may cause high CPU usage');
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
                }
            });
        }
    });
};

// To let another bundle's index.js take advantage of sublistener, we must export an event listener.
// Socket.io dosn't work for inter-extension communication, because broadcasts don't loopback.
util.inherits(Sublistener, events.EventEmitter);

Sublistener.prototype.isBroadcaster = function(user, channel) {
    // Remove the leading "#" from channel when comparing
    return user.username === channel.slice(1);
};

Sublistener.prototype.isModerator = function(user) {
    return user.special.indexOf('moderator') >= 0;
};

Sublistener.prototype.isDuplicate = function(username, channel) {
    return history[channel].find(username) >= 0;
};

Sublistener.prototype.acceptSubscription = function (username, channel) {
    var content = { name: username, resub: false, channel: channel }; //resub not implemented
    nodecg.sendMessage('subscriber', content);
    this.emit('subscriber', content);
};

module.exports = function(extensionApi) { new Sublistener(extensionApi) };
