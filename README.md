#lfg-sublistener
This is a [NodeCG](http://github.com/nodecg/nodecg) bundle.

Listens to one or many Twitch chat channels via IRC for "subscription" events.
Upon hearing one, it emits a NodeCG API message that other bundles can listen to and use.
Also displays recent subscriptions on the dashboard.

If [lfg-twitchapi](https://github.com/SupportClass/lfg-twitchapi) is present, sublistener will also poll the API every 60 seconds to fill in any gaps left by TwitchNotify.

This bundle integrates with [lfg-nucleus](https://github.com/SupportClass/lfg-nucleus).

## Installation
- Install to `nodecg/bundles/lfg-sublistener`
	- If [nodecg-cli](https://www.npmjs.com/package/nodecg-cli) is installed use `nodecg install SupportClass/lfg-sublistener`
- Create `nodecg/cfg/lfg-sublistener.json` with a valid [tmi.js configuration](https://www.tmijs.org/docs/Configuration.html).

### Config Example
```json
{
	"tmi.js": {
		"connection": {
			"reconnect": true
		},
		"identity": {
			"username": "YOUR_USERNAME",
			"password": "oauth:YOUR_OAUTH"
		},
		"channels": ["ANY_CHANNEL"]
	}
}
```

## Usage

First, add `lfg-sublistener` to your bundle's [`nodecg.bundleDependencies`](http://nodecg.com/tutorial-manifest.html).
This will ensure that `lfg-sublistener` loads before your bundle.

### In a graphic or dashboard panel
```js
nodecg.listenFor('subscription', 'lfg-sublistener', subscription => {
    // do work
});
```

### In an extension
```js
module.exports = function (nodecg) {
	var sublistener = nodecg.extensions['lfg-sublistener'];
	
	sublistener.on('subscription', data => {
		// do work
	});
}
```

## Data Structure
```js
{
	"name": "langeh",
	"channel": "chrishanel",
	"resub": true,
	"months" 3,
	"timestamp": 1456850909701,
	"prime": false
}
```

### License
lfg-sublistener is provided under the MIT license, which is available to read in the [LICENSE][] file.
[license]: LICENSE
