'use strict';

var MAX_LENGTH = 5;
var history = [];

module.exports.add = function(username) {
    history.unshift(username);
    while (history.length > MAX_LENGTH) {
        history.pop();
    }
};

module.exports.find = function(username) {
    return history.indexOf(username);
};

