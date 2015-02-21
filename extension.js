'use strict';

var irc = require('twitch-irc'),
    events = require('events'),
    util = require('util'),
    path = require('path'),
    locallydb = require('locallydb'),
    nodecg = {},
    hist = {};

var MAX_LEN = 200;
var POLL_INTERVAL = 60 * 1000;
var DBPATH = path.resolve(__dirname, '../../db/lfg-sublistener');

// load the database folder, the collections will be made/loaded later
var db = new locallydb(DBPATH);

var Sublistener = function(extensionApi) {
    nodecg = extensionApi;

    if (!Object.keys(nodecg.bundleConfig).length) {
        throw new Error('[lfg-sublistener] No config found in cfg/lfg-sublistener.json, aborting!');
    }

    var self = this;

    // If lfg-twitchapi is present, set up polling as a backup
    if (nodecg.extensions.hasOwnProperty('lfg-twitchapi')) {
        var twitchApi = nodecg.extensions['lfg-twitchapi'];

        nodecg.log.info('lfg-twitchapi found, using API polling to augment subscription detection');

        // Poll for subs every POLL_INTERVAL milliseconds
        // If any of the subs returned aren't already in the history, add them.
        setInterval(function() {
            twitchApi('GET', '/channels/{{username}}/subscriptions', { limit: MAX_LEN/4, direction: 'desc' },
                function(err, code, body) {
                    if (err) {
                        nodecg.log.error(err);
                        return;
                    }

                    if (code !== 200) {
                        nodecg.log.error(body.error, body.message);
                        return;
                    }

                    // Go through subs in reverse, from oldest to newest
                    body.subscriptions.reverse().forEach(function(subscription) {
                        var username = subscription.user.name;
                        var channel = body.channel;
                        if (!self.isDuplicate(username, channel)) {
                            self.acceptSubscription(username, channel);
                        }
                    });
                });
        }, POLL_INTERVAL);
    } else {
        nodecg.log.warn('lfg-twitchapi not present, API polling will not be available');
    }

    nodecg.bundleConfig['twitch-irc'].channels.forEach(function(channel) {
        hist[channel] = db.collection(channel, db, false); // Disable autosave
    });

    events.EventEmitter.call(this);
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

    function onSubscription(channel, username, months) {
        var channelNoPound = channel.replace('#', '');
        if (!self.isDuplicate(username, channelNoPound, months)) {
            self.acceptSubscription(username, channelNoPound, months);
        }
    }

    client.connect();
    client
        .addListener('connected', function onConnected() {
            nodecg.variables.reconnecting = false;
            self.log('info', 'Listening for subscribers on ' + nodecg.bundleConfig['twitch-irc'].channels);
        })

        .addListener('disconnected', function onDisconnected(reason) {
            self.log('warn', 'DISCONNECTED: ' + reason);
        })

        .addListener('reconnect', function onReconnect() {
            nodecg.variables.reconnecting = true;
            self.log('info', 'Attempting to reconnect...');
        })

        .addListener('connectfail', function onConnectFail() {
            self.log('error', 'Failed to connect, reached maximum number of retries');
        })

        .addListener('limitation', function onLimitation(err) {
            self.log('error', err);
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
            if (!self.isBroadcaster(user, channelNoPound) && !self.isModerator(user))
                return;

            var parts = message.split(' ',2);
            var cmd = parts[0];
            var arg = parts.length > 1 ? parts[1] : null;

            if (!arg) return;
            switch (cmd) {
                case '!sendsub':
                    if (self.isDuplicate(arg, channelNoPound)) {
                        client.say(channel, 'That username, ' + arg +
                            ', appears to be a duplicate. Use !sendsubforce to override.');
                        break;
                    }
                    /* falls through */
                case '!sendsubforce':
                    self.acceptSubscription(arg, channelNoPound);
                    client.say(channel, 'Added ' + arg + ' as a subscriber');
                    break;
            }
        });
    }
};

// To let another bundle's extension take advantage of sublistener, we must export an event listener.
util.inherits(Sublistener, events.EventEmitter);

Sublistener.prototype.isBroadcaster = function(user, channel) {
    return user.username === channel;
};

Sublistener.prototype.isModerator = function(user) {
    return user.special.indexOf('moderator') >= 0;
};

/**
 * Checks if a subscription (or sub anniversary) already exists in the history.
 *
 * @params {string} username
 * @params {string} channel
 * @params {integer} months
 * @returns {boolean}
 */
Sublistener.prototype.isDuplicate = function(username, channel, months) {
    username = username.toLowerCase();
    var isDupe = false;
    try {
        if (months) {
            isDupe = hist[channel].where({ name: username, months: months }).items.length > 0;
        } else {
            isDupe = hist[channel].where({ name: username }).items.length > 0;
        }
    } catch(e) {
        nodecg.log.error('Dupe check failed, assuming not a dupe:', e.stack);
    }
    return isDupe;
};

/**
 * Emits a 'subscription' event and adds it to the history.
 *
 * @params {string} username
 * @params {string} channel
 * @params {integer} months
 */
Sublistener.prototype.acceptSubscription = function (username, channel, months) {
    // Chat reports usernames all lowercase, but the API reports them with proper case.
    username = username.toLowerCase();

    // 2014-01-15: quick and dirty hack to make sure that we only accept subs
    // that are for one of the channels we are listening to
    if (nodecg.bundleConfig['twitch-irc'].channels.indexOf(channel) < 0) return;

    var content = {
        name: username,
        resub: months ? true : false,
        channel: channel,
        ts: Date.now()
    };

    if (months) content.months = months;

    // Okay, there's some real funny business going on here.
    // `collection.insert` mutates the original object passed into it, so we have to clone it
    hist[channel].insert(util._extend({}, content));
    var items = hist[channel].items;
    while (items.length > MAX_LEN) { // If we have more than MAX_LEN items, remove the oldest items
        items.shift();
    }
    hist[channel].items = items;
    hist[channel].save();

    //... Likewise, other bundles that listen to this event emitter mutate `content`
    // Since our collection keeps a permanent reference to these objects in `collection.items`,
    // Any changes that other bundles make ripple back into our database. Fun!
    // But since we passed a close to `collection.insert`, we avoid these ripple effects.
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
