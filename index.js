'use strict';

var io = require('../../server.js'),
    fs = require('fs'),
    squirrel = require('squirrel'),
    EventEmitter = require('events').EventEmitter,
    emitter = new EventEmitter(),
    log = require('../../lib/logger'),
    History = require('./backend/history');

// To let another bundle's index.js take advantage of sublistener, we must export an event listener.
// Socket.io dosn't work for inter-index.js communication, because broadcasts don't loopback.
module.exports = emitter;

var cfgPath = __dirname + '/config.json';
if (!fs.existsSync(cfgPath)) {
    throw new Error('[eol-sublistener] config.json was not present in bundles/eol-sublistener, aborting');
}
var config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

var history = {};
config['twitch-irc'].channels.forEach(function(channel) {
    history['#' + channel] = new History();
});

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

    client.addListener('crash', function (message, stack) {
        throw new Error("[eol-sublistener] " + stack);
    });

    client.addListener('subscription', function onSubscription(channel, username) {
        if (!isDuplicate(arg, channel)) {
            acceptSubscription(username)
        }
    });

    if (config.chatevents) {
        log.warn('[eol-sublistener] Chat events are on, may cause high CPU usage');
        client.addListener('chat', function onChat(channel, user, message) {
            if (!isBroadcaster(user, channel) && !isModerator(user))
                return;

            var parts = message.split(' ',2);
            var cmd = parts[0];
            var arg = parts.length > 1 ? parts[1] : null;

            if (!arg)
                return;

            switch (cmd) {
                case '!sendsub':
                    if (isDuplicate(arg, channel)) {
                        client.say(channel, 'That username, ' + arg + ', appears to be a duplicate. Use !sendsubforce to override.');
                        break;
                    }
                case '!sendsubforce':
                    history[channel].add(arg);
                    acceptSubscription(channel, arg);
                    client.say(channel, 'Added ' + arg + ' as a subscriber');
            }
        });
    }
});

function isBroadcaster(user, channel) {
    // Remove the leading "#" from channel when comparing
    return user.username === channel.slice(1);
}

function isModerator(user) {
    return user.special.indexOf('moderator') >= 0;
}

function isDuplicate(username, channel) {
    return history[channel].find(username) >= 0;
}

function acceptSubscription(username) {
    var content = { name: username, resub: false }; //resub not implemented
    io.sockets.json.send({
        bundleName: 'eol-sublistener',
        messageName: 'subscriber',
        content: content
    });
    emitter.emit('subscriber', content);
}
