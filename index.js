var io = require('../../server.js'),
    fs = require('fs'),
    squirrel = require('squirrel'),
    EventEmitter = require('events').EventEmitter,
    emitter = new EventEmitter();

// To let another bundle's index.js take advantage of sublistener, we must export an event listener.
// Socket.io dosn't work for inter-index.js communciation, because broadcasts don't loopback.
module.exports = emitter;

var cfgPath = __dirname + '/config.json';
if (!fs.existsSync(cfgPath)) {
    throw new Error('[eol-sublistener] config.json was not present in bundles/eol-sublistener, aborting!');
}
var ircConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// Lazy-load and lazy-install the node-twitch-irc npm package if necessary
squirrel('node-twitch-irc', function twitchIrcLoaded(err, irc) {
    var client = new irc.connect(ircConfig, function(err, event) {
        if (!err) {
            // "Subscribe" event.
            event.on("subscribe", function onSubscribe(channel, username, resub) {
                var content = { name: username, resub: resub };
                io.sockets.json.send({
                    bundleName: 'eol-sublistener',
                    messageName: 'subscriber',
                    content: content
                });
                emitter.emit('subscriber', content);
            });

            // For testing purposes
            // Uses chat events as a substitute for subscriber events
            if (ircConfig.chatevents) {
                console.warn('[eol-sublistener] WARNING! Chat events are on, this may cause significant CPU usage');
                event.on("chat", function onChat(user, channel, message) {
                    if (isBroadcaster(user, channel) || isModerator(user)) {
                        if (message.indexOf('!sendsub') === 0 && message.indexOf(' ') > 0) {
                            var name = message.split(' ',2)[1];
                            if (name == false)
                                return;

                            var content = { name: name, resub: false };
                            io.sockets.json.send({
                                bundleName: 'eol-sublistener',
                                messageName: 'subscriber',
                                content: content
                            });
                            emitter.emit('subscriber', content);
                        }
                    }
                });
            }

            // "Connected" event.
            event.on("connected", function onConnected() {
                console.log('[eol-sublistener] Listening for subscribers on', ircConfig.channels)
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

function isBroadcaster(user, channel) {
    // Remove the leading "#" from channel
    return user.username === channel.slice(1);
}

function isModerator(user) {
    return user.special.indexOf('moderator') >= 0;
}
