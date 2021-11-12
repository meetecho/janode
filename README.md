## About Janode

Janode is a Node.js, browser compatible, adapter for the [Janus WebRTC server](https://github.com/meetecho/janus-gateway).

Internally uses WebSockets to connect to Janus.

The library wraps the Janus core API, the Janus Admin API and some of the most popular plugins APIs.

The supported Janus plugins currently are:

- EchoTest
- AudioBridge
- Streaming
- VideoRoom

## Example of usage

This is just a pretty simple hello world for the echotest plugin.
Read the examples [on the git repo](https://github.com/meetecho/janode) to have some more details.


```
const Janode = require('janode');
const { Logger } = Janode;
const EchoTestPlugin = require('janode/src/plugins/echotest-plugin');

const connection = await Janode.connect({
  is_admin: false,
  address: {
    url: 'ws://127.0.0.1:8188/',
    apisecret: 'secret'
  }
});
const session = await connection.create();

// Attach to a plugin using the plugin descriptor
const echoHandle = await session.attach(EchoTestPlugin)

// Janode exports "EVENT" property with core events
echoHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, _ => Logger.info('webrtcup event'));
echoHandle.on(Janode.EVENT.HANDLE_MEDIA, evtdata => Logger.info('media event', evtdata));
echoHandle.on(Janode.EVENT.HANDLE_SLOWLINK, evtdata => Logger.info('slowlink event', evtdata));
echoHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info('hangup event', evtdata));
echoHandle.on(Janode.EVENT.HANDLE_DETACHED, evtdata => Logger.info('detached event', evtdata));

// Refer to plugin documentation

// plugins export "EVENT" property with specific plugin events
echoHandle.on(EchoTestPlugin.EVENT.ECHOTEST_RESULT, evtdata => Logger.info('echotest result event', evtdata));

// Specific method exported by the plugin
// "offer" got from the client
const { jsep: answer } = await echoHandle.start({ video: true, jsep: offer });

// detach the handle
await echoHandle.detach();

```

## Admin API example

```
const Janode = require('janode');

const admin = await Janode.connect({
  is_admin: true,
  address: {
    url: 'ws://127.0.0.1:7188/',
    apisecret: 'secret'
  }
});

// Get the list of active sessions
const data = await admin.listSessions();

```

## Installation

```
npm run build
```

## Running examples (only available from the git repo)

Examples are only available in the code fetched from git repo and are not published on npm.

```
cd examples/echotest
npm run build
npm run build-config
node src/echotest.js --janode-log=info
```
To change the configuration edit `config.js` under `src`.

## Usage in browsers

The core library should work in browsers.
Just create a bundle by using tools like `browserify` and import it in your web app.

If you get the code from the repo, there is a sample browser app under `examples/browser/app`.
The provided `bundle.sh` script in `examples/browser` uses `browserify` to bundle an echotest library `bundle.js` in `examples/browser/app`.
The `bundle.js` script exposes a `janodeLib` global object that is used by the web app.
