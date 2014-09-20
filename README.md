#eol-sublistener

This bundle listens to a given Twitch chat via IRC for "subscribe" events, both new and re-subscriptions. 
Upon hearing one, it emits a NodeCG API message that other bundles can listen to and use.

## Installation

- Install to `nodecg/bundles/eol-sublistener`
- Create `config.json` in `nodecg/bundles/eol-sublistener`
- Edit `config.json` to contain a valid [node-twitch-irc configuration](https://github.com/Schmoopiie/node-twitch-irc/wiki/Configuration) in JSON format.

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
    "twitchclient": 3
}
```

## Usage

If you simply want a list of recent subs on your dashboard, you are done.

If you would like to use this data in another bundle, add the following code to your view/panel:
```
nodecg.listenFor('subscriber', 'eol-sublistener', callback);
```
... where 'callback' is the name of a function with the signature `function callback(data)`

