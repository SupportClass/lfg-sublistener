#eol-sublistener

This bundle listens to a given Twitch chat via IRC for "subscribe" events, both new and re-subscriptions. 
Upon hearing one, it emits a NodeCG API message that other bundles can listen to and use.
Also displays recent subscribers on the dashboard.

## Installation

- Install to `nodecg/bundles/eol-sublistener`
- Create `config.json` in `nodecg/bundles/eol-sublistener`
- Edit `config.json` to contain a valid [node-twitch-irc configuration](https://github.com/Schmoopiie/node-twitch-irc/wiki/Configuration) in JSON format.
- NOTE: There is a custom boolean parameter called "chatevents". If 'false', chat events will not be hooked, thereby saving CPU and RAM.

### Config Example
```
{
    "autoreconnect": true,
    "channels": ["channelname"],
    "server": "irc.twitch.tv",
    "port": 6667,
    "nickname": "username",
    "oauth": "oauth:tokenhere",
    "debug": false,
    "twitchclient": 3,
    "chatevents": false
}
```

## Usage

### Dashboard Panel
If you simply want a list of recent subs on your dashboard, you are done.

### Use in other bundles' view pages and dashboard panels
If you would like to use this data in another bundle, add the following code to your view/panel:
```
nodecg.listenFor('subscriber', 'eol-sublistener', callback);
```
... where 'callback' is the name of a function with the signature `function callback(data)`

### Use in other bundles' extensions
If you want to use subscriber events in another bundle's extension, add the following code:
```
var sublistener = require('../eol-sublistener');

sublistener.on('subscriber', function(data) {
    // do work
    // data.name = Twitch username of subscriber
    // data.resub = Boolean
});
```

