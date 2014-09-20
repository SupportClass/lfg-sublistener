var express = require('express'),
    app = module.exports = express(),
    io = require('../../server.js'),
    squirrel = require('squirrel');

// Lazy-load and lazy-install the node-twitch-irc npm package if necessary
squirrel('node-twitch-irc', function twitchIrcLoaded(err, irc) {
    var ircConfig = {
        autoreconnect: true,
        channels: ['langeh'],
        server: 'irc.twitch.tv',
        port: 6667,
        nickname: 'chrishanel',
        oauth: 'oauth:3vh50cexpubd9dwrwt3tzerpyvsq7dg',
        debug: false,
        twitchclient: 3
    };

    var client = new irc.connect(ircConfig, function(err, event) {
        if (!err) {
            // "Subscribe" event.
            event.on("subscribe", function onSubscribe(channel, username, resub) {
                io.sockets.json.send({
                    bundleName: 'sublist',
                    messageName: 'sub',
                    content: {
                        name: username,
                        resub: resub
                    }
                });
            });

            // "Connected" event.
            event.on("connected", function onConnected() {
                console.log('[sublist] Listening for subscribers...')
            });

            event.on("chat", function (user, channel, message) {
                console.log("got chat from " + user.username + ": " + message);
                io.sockets.json.send({
                    bundleName: 'sublist',
                    messageName: 'subscriber',
                    content: {
                        name: user.username,
                        resub: true
                    }
                });
            });

            // "Disconnected" event.
            event.on("disconnected", function onDisconnected(reason) {
                console.log('[sublist] DISCONNECTED: '+reason);
            });
        } else  {
            console.log(err);
        }
    });
});