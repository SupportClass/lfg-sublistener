'use strict';

const hist = {};
const MAX_LEN = 100;
const JSONStorage = require('node-localstorage').JSONStorage;
const jsonStorage = new JSONStorage('./db/lfg-sublistener');

module.exports = {
	/**
	 * Adds a subscription event to the history.
	 * @param username {string}
	 * @param channel {string}
	 * @param [months] {number}
	 */
	add(username, channel, months) {
		username = username.toLowerCase();
		channel = channel.toLowerCase();

		// Make the channel key if it doesn't exist yet
		if (!{}.hasOwnProperty.call(hist, channel)) {
			hist[channel] = jsonStorage.getItem(channel) || [];
		}

		// Add item to history
		hist[channel].push({
			username,
			months
		});

		// Maintain a reasonable max length for the history
		const items = hist[channel];
		while (items.length > MAX_LEN) { // If we have more than MAX_LEN items, remove the oldest items
			items.shift();
		}

		jsonStorage.setItem(channel, hist[channel]);
	},

	/**
	 * Checks if a subscription event (identified by a username+months pair) to a
	 * given channel already exists in the history.
	 * @param username {string}
	 * @param channel {string}
	 * @param months {number}
	 * @returns {boolean}
	 */
	exists(username, channel, months) {
		username = username.toLowerCase();
		channel = channel.toLowerCase();

		let exists = false;

		if (!{}.hasOwnProperty.call(hist, channel)) {
			hist[channel] = jsonStorage.getItem(channel) || [];
		}

		if (hist[channel].length > 0) {
			if (typeof months === 'undefined') {
				exists = hist[channel].some(currentValue => {
					return currentValue.username === username;
				});
			} else {
				exists = hist[channel].some(currentValue => {
					return currentValue.username === username && currentValue.months === months;
				});
			}
		}

		return exists;
	},

	MAX_LEN
};
