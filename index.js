var express = require('express'),
    app = module.exports = express(),
    io = require('../../server.js'),
    fs = require('fs'),
    squirrel = require('squirrel');

var cfgPath = __dirname + '/config.json';
if (!fs.existsSync(cfgPath)) {
    throw new Error('[eol-sublistener] config.json was not present in bundles/eol-sublistener, aborting!');
}

// Lazy-load and lazy-install the node-twitch-irc npm package if necessary
squirrel('node-twitch-irc', function twitchIrcLoaded(err, irc) {
    var ircConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

    var client = new irc.connect(ircConfig, function(err, event) {
        if (!err) {
            // "Subscribe" event.
            event.on("subscribe", function onSubscribe(channel, username, resub) {
                io.sockets.json.send({
                    bundleName: 'eol-sublistener',
                    messageName: 'subscriber',
                    content: {
                        name: username,
                        resub: resub
                    }
                });
            });

            // "Connected" event.
            event.on("connected", function onConnected() {
                console.log('[eol-sublistener] Listening for subscribers...')
            });

            // "Disconnected" event.
            event.on("disconnected", function onDisconnected(reason) {
                console.log('[eol-sublistener] DISCONNECTED: '+reason);
            });
        } else  {
            console.log(err);
        }
    });
});