'use strict';

var hist = {};
var MAX_LEN = 100;

if (typeof localStorage === 'undefined' || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    var localStorage = new LocalStorage('./db/lfg-sublistener');
}

module.exports = {
    add: function(username, channel, months) {
        username = username.toLowerCase();
        channel = channel.toLowerCase();

        // Make the channel key if it doesn't exist yet
        if (!hist.hasOwnProperty(channel)) {
            hist[channel] = JSON.parse(localStorage.getItem(channel)) || [];
        }

        // Add item to history
        hist[channel].push({
            username: username,
            months: months
        });

        // Maintain a reasonable max length for the history
        var items = hist[channel];
        while (items.length > MAX_LEN) { // If we have more than MAX_LEN items, remove the oldest items
            items.shift();
        }

        localStorage.setItem(channel, JSON.stringify(hist[channel]));
    },
    exists: function(username, channel, months) {
        username = username.toLowerCase();
        channel = channel.toLowerCase();

        var exists = false;
        if (hist[channel]) {
            if (typeof months !== 'undefined') {
                exists = hist[channel].some(function(currentValue) {
                    if (currentValue.username === username && currentValue.months === months) return true;
                });
            } else {
                exists = hist[channel].some(function(currentValue) {
                    if (currentValue.username === username) return true;
                });
            }
        }
        return exists;
    },
    MAX_LEN: MAX_LEN
};
