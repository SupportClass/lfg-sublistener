#eol-sublistener

This bundle listens to a given Twitch chat via IRC for "subscription" events.
Upon hearing one, it emits a NodeCG API message that other bundles can listen to and use.
Also displays recent subscriptions on the dashboard.

## Installation``

- Install to `nodecg/bundles/eol-sublistener`
- Create `config.json` in `nodecg/bundles/eol-sublistener`
- Edit `config.json` to contain a valid [twitch-irc configuration](https://github.com/Schmoopiie/twitch-irc/wiki#configuration) in JSON format.
- NOTE: There is a custom boolean parameter called "chatevents". If 'false', chat events will not be hooked, thereby saving CPU and RAM.

### Config Example
```
#!json
{
  "twitch-irc": {
    "options": {
    },
    "identity": {
      "username": "YOUR_USERNAME",
      "password": "oauth:YOUR_OAUTH"
    },
    "channels": ["ANY_CHANNEL"]
  },
  "chatevents": fakse
}
```

## Usage

### Dashboard Panel
If you simply want a list of recent subs on your dashboard, you are done.

### Use in other bundles' view pages and dashboard panels
If you would like to use this data in another bundle, add the following code to your view/panel:
```
#!javascript
nodecg.listenFor('subscription', 'eol-sublistener', callback);
```
... where 'callback' is the name of a function with the signature `function callback(data)`

### Use in other bundles' extensions
If you want to use subscription events in another bundle's extension, add the following code:
```
#!javascript
var sublistener = require('../eol-sublistener');

sublistener.on('subscription', function(data) {
    // do work
    // data.name = Twitch username of subscription
    // data.resub = Boolean
});
```

