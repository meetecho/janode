## About Janode

Janode is a Node.js, browser compatible, adapter for the [Janus WebRTC server](https://github.com/meetecho/janus-gateway).

Internally uses WebSockets or Unix DGRAM Sockets to connect to Janus.

The library wraps the Janus core API, the Janus Admin API and some of the most popular plugins APIs.

The supported Janus plugins currently are:

- EchoTest
- AudioBridge
- Streaming
- VideoRoom

The library is available on [npm](https://www.npmjs.com/package/janode) and the source code is on [github](https://github.com/meetecho/janode).

## Example of usage

This is just a pretty simple hello world for the echotest plugin.
Read the examples [on the git repo](https://github.com/meetecho/janode) to have some more details.


```js
import Janode from 'janode';
const { Logger } = Janode;
import EchoTestPlugin from 'janode/plugins/echotest';

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

```js
import Janode from 'janode';

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

## Switching to other transports

The kind of transport used for a connection depends on the protocol/scheme defined in the `url` field of the configuration.

```js
/* Use UNIX DGRAM Sockets */
const admin = await Janode.connect({
  is_admin: true,
  address: {
    url: 'file://tmp/janusapi',
    apisecret: 'secret'
  }
});
```

```js
/* Use WebSockets */
const admin = await Janode.connect({
  is_admin: true,
  address: {
    url: 'ws://127.0.0.1:7188/',
    apisecret: 'secret'
  }
});
```

## Installation

Installing the library from npm is as easy as:


```bash
npm install janode
```

On the other hand, in case you got the code from git you must build the library through:


```bash
npm run build
```

## Running examples (only available from the git repo)

Examples are only available in the code fetched from git repo and are not published on npm.

```bash
cd examples/echotest
npm run build
npm run build-config
node src/echotest.js --janode-log=info
```
To change the configuration edit `config.js` under `src`.

## Usage in browsers

Janode should work in browsers.
You need to create a bundle with the core library and the needed plugins using a tool that can:
- shim native node modules (e.g. `EventEmitter`)
- import commonjs modules (some dependencies could still use that format)
- parse the `browser` field in the `package.json`

If you get the code from the repo, you can find a `rollup` bundling sample in the `bundle.sh` script under `examples/browser/`.
The output will be a `bundle.js` script that defines an `App` global object with the members `Janode` and `EchoTestPlugin`.
