'use strict';

var io = require('../../server.js'),
    fs = require('fs'),
    squirrel = require('squirrel'),
    EventEmitter = require('events').EventEmitter,
    emitter = new EventEmitter(),
    log = require('../../lib/logger');

// To let another bundle's index.js take advantage of sublistener, we must export an event listener.
// Socket.io dosn't work for inter-index.js communication, because broadcasts don't loopback.
module.exports = emitter;

var cfgPath = __dirname + '/config.json';
if (!fs.existsSync(cfgPath)) {
    throw new Error('[eol-sublistener] config.json was not present in bundles/eol-sublistener, aborting!');
}
var ircConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// Lazy-load and lazy-install the node-twitch-irc npm package if necessary
squirrel('twitch-irc', function twitchIrcLoaded(err, irc) {
    var client = new irc.client(ircConfig);

    client.connect();

    client.addListener('connected', function onConnected(address, port) {
        var msg = '[eol-sublistener] Listening for subscribers on ' + ircConfig.channels;
        log.info(msg);
    });

    client.addListener('subscription', function onSubscription(channel, username) {
        var content = { name: username, resub: false }; //resub not implemented
        io.sockets.json.send({
            bundleName: 'eol-sublistener',
            messageName: 'subscriber',
            content: content
        });
        emitter.emit('subscriber', content);
    });

    if (ircConfig.chatevents) {
        log.warn('[eol-sublistener] Chat events are on, may cause high CPU usage');
        client.addListener('chat', function onChat(channel, user, message) {
            if (!isBroadcaster(user, channel) && !isModerator(user))
                return;

            var parts = message.split(' ',2);
            var cmd = parts[0];
            var arg = parts.length > 1 ? parts[1] : null;

            if (cmd === '!sendsub' && arg) {
                var content = { name: arg, resub: false };
                io.sockets.json.send({
                    bundleName: 'eol-sublistener',
                    messageName: 'subscriber',
                    content: content
                });
                emitter.emit('subscriber', content);
            }
        });
    }

    client.addListener('disconnected', function onDisconnected(reason) {
        log.warn('[eol-sublistener] DISCONNECTED:', reason);
    });
});

function isBroadcaster(user, channel) {
    // Remove the leading "#" from channel when comparing
    return user.username === channel.slice(1);
}

function isModerator(user) {
    return user.special.indexOf('moderator') >= 0;
}
