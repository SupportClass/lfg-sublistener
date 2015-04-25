'use strict';

var events = require('events');
var util = require('util');
var nodecg = {};
var hist = require('./extension/history.js');

var Sublistener = function(extensionApi) {
    var self = this;
    nodecg = extensionApi;

    // 2015-4-22: Temporary hack to make lfg-sublistener actually viable in production
    // If manual garbage collection has been exposed, run it every 15 minutes
    if (global.gc) {
        nodecg.log.info('Running manual garbage collection every 30 minutes');
        setInterval(function() {
            nodecg.log.info('Running manual garbage collection');
            global.gc();
        }, 15 * 60 * 1000);
    }

    // Only start twitch-irc if there are channels to listen to
    if (nodecg.bundleConfig['twitch-irc'] && nodecg.bundleConfig['twitch-irc'].channels.length > 0) {
        var ircListener = require('./extension/irc_listener')(nodecg, self.log);
        ircListener.on('subscription', function(username, channel, months) {
            if (!hist.exists(username, channel, months)) {
                self.acceptSubscription(username, channel, months);
            }
        });
        ircListener.on('forcedSubscription', function(username, channel, months) {
            self.acceptSubscription(username, channel, months);
        });
    }

    // If lfg-twitchapi and an appropriate config are present, set up polling
    if (nodecg.extensions.hasOwnProperty('lfg-twitchapi')) {
        if (nodecg.config.login.twitch.scope.split(' ').indexOf('channel_subscriptions') < 0) {
            nodecg.log.error('lfg-twitchapi found, but the current NodeCG config lacks the "channel_subscriptions" scope.' +
                ' As a result, lfg-twitchapi will not be loaded.');
        } else {
            var apiPoller = require('./extension/api_poller')(nodecg);
            apiPoller.on('gotSubscriptions', function(channel, subscriptions) {
                // Go through subs in reverse, from oldest to newest
                subscriptions.reverse().forEach(function(subscription) {
                    var username = subscription.user.name;
                    if (!hist.exists(username, channel)) {
                        self.acceptSubscription(username, channel);
                    }
                });
            });
        }
    } else {
        nodecg.log.warn('lfg-twitchapi not present, API polling will not be available');
    }

    events.EventEmitter.call(this);
};

// To let another bundle's extension take advantage of sublistener, we must export an event listener.
util.inherits(Sublistener, events.EventEmitter);

/**
 * Emits a 'subscription' event and adds it to the history.
 *
 * @params {string} username
 * @params {string} channel
 * @params {integer} months
 */
Sublistener.prototype.acceptSubscription = function (username, channel, months) {
    var content = {
        name: username,
        resub: months ? true : false,
        channel: channel,
        ts: Date.now()
    };

    if (months) content.months = months;
    nodecg.sendMessage('subscription', content);
    this.emit('subscription', content);
    hist.add(username, channel, months);
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
