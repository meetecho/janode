/* eslint-disable multiline-comment-style */
/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let streamingPeerConnection;
const remoteVideo = document.getElementById('remoteVideo');
const myStream = parseInt(getURLParameter('stream')) || 1;
const myPin = getURLParameter('pin') || null;

let decoder;

const button = document.getElementById('button');
button.onclick = () => {
  if (socket.connected)
    socket.disconnect();
  else
    socket.connect();
};

function getId() {
  return Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
}

function getURLParameter(name) {
  // eslint-disable-next-line no-sparse-arrays
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ''])[1].replace(/\+/g, '%20')) || null;
}

const scheduleConnection = (function () {
  let task = null;
  const delay = 5000;

  return (function (secs) {
    if (task) return;
    const timeout = secs * 1000 || delay;
    console.log('scheduled watching in ' + timeout + ' ms');
    task = setTimeout(() => {
      watch();
      task = null;
    }, timeout);
  });
})();

const socket = io({
  rejectUnauthorized: false,
  autoConnect: false,
  reconnection: false,
});

function watch({ id = myStream, pin = myPin, restart = false } = {}) {
  if (!restart) {
    stopAllStreams();
    closePC();
  }
  const watchdata = {
    id,
    pin,
    restart,
  };

  socket.emit('watch', {
    data: watchdata,
    _id: getId(),
  });
}

function start({ jsep } = {}) {
  const startdata = {};
  if (jsep) startdata.jsep = jsep;

  socket.emit('start', {
    data: startdata,
    _id: getId(),
  });
}

function _pause() {
  socket.emit('pause', {
    _id: getId(),
  });
}

function _stop() {
  socket.emit('stop', {
    _id: getId(),
  });
}

function _configure({ audio, video, data, substream, temporal, fallback }) {
  socket.emit('configure', {
    data: {
      audio,
      video,
      data,
      substream,
      temporal,
      fallback,
    },
    _id: getId(),
  });
}

function trickle({ candidate }) {
  const trickleData = candidate ? { candidate } : {};
  const trickleEvent = candidate ? 'trickle' : 'trickle-complete';

  socket.emit(trickleEvent, {
    data: trickleData,
    _id: getId(),
  });
}

function _list() {
  socket.emit('list', {
    _id: getId(),
  });
}

function _info({ id = myStream, secret = 'adminpwd' } = {}) {
  socket.emit('info', {
    data: {
      id,
      secret,
    },
    _id: getId(),
  });
}

function _enable({ id = myStream, secret = 'adminpwd' } = {}) {
  socket.emit('enable', {
    data: {
      id,
      secret,
    },
    _id: getId(),
  });
}

function _disable({ id = myStream, stop_recording = true, secret = 'adminpwd' } = {}) {
  socket.emit('disable', {
    data: {
      id,
      stop_recording,
      secret,
    },
    _id: getId(),
  });
}

function _startRec({ id = myStream, secret = 'adminpwd' } = {}) {
  socket.emit('start-rec', {
    data: {
      id,
      secret,
    },
    _id: getId(),
  });
}

function _stopRec({ id = myStream, secret = 'adminpwd' } = {}) {
  socket.emit('stop-rec', {
    data: {
      id,
      secret,
    },
    _id: getId(),
  });
}

function _createMp({ audio, video, data, secret = null, pin = null } = {}) {
  const settings = {};
  settings.name = 'test_opus_vp8_' + Date.now();
  settings.description = 'this is ' + settings.name;
  settings.secret = secret || null;
  settings.pin = pin || null;
  settings.permanent = false;
  settings.is_private = false;
  if (audio) {
    settings.audio = typeof audio === 'object' ? audio : {};
    settings.audio.port = settings.audio.port || 0;
    settings.audio.pt = settings.audio.pt || 111;
    settings.audio.rtpmap = settings.audio.rtpmap || 'opus/48000/2';
  }
  if (video) {
    settings.video = typeof video === 'object' ? video : {};
    settings.video.port = settings.video.port || 0;
    //settings.video.port2 = settings.video.port2 || 0;
    //settings.video.port3 = settings.video.port3 || 0;
    //setting.video.rtcpport = setting.video.rtcpport || 0;
    settings.video.pt = settings.video.pt || 100;
    settings.video.rtpmap = settings.video.rtpmap || 'VP8/90000';
    //settings.video.buffer = settings.video.buffer || false;
  }
  if (data) {
    settings.data = typeof data === 'object' ? data : {};
    //settings.data.buffer = settings.data.buffer || false;
  }
  socket.emit('create', {
    data: settings,
    _id: getId(),
  });
}

function _destroyMp({ id = myStream, secret = 'adminpwd' } = {}) {
  socket.emit('destroy', {
    data: {
      id,
      secret,
    },
    _id: getId(),
  });
}

socket.on('connect', () => {
  console.log('socket connected');
  socket.sendBuffer = [];
  scheduleConnection(0.1);
});

socket.on('disconnect', () => {
  console.log('socket disconnected');
  stopAllStreams();
  closePC();
});

socket.on('streaming-error', ({ error }) => {
  console.log('streaming error received:', error);
  if (error === 'backend-failure' || error === 'session-not-available') {
    socket.disconnect();
  }
});

socket.on('offer', async ({ data }) => {
  console.log('offer received', data);
  try {
    const answer = await doAnswer(data.jsep);
    start({ jsep: answer });
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
  }
});

socket.on('preparing', () => console.log('preparing streaming'));

socket.on('starting', () => console.log('starting streaming'));

socket.on('started', () => console.log('started streaming'));

socket.on('pausing', () => console.log('pausing streaming'));

socket.on('stopping', () => console.log('stopping streaming'));

socket.on('stopped', () => console.log('stopped streaming'));

socket.on('configured', ({ data }) => console.log('configured streaming', data));

socket.on('enabled', ({ data }) => console.log('enabled mountpoint', data));

socket.on('disabled', ({ data }) => console.log('disabled mountpoint', data));

socket.on('info', ({ data }) => console.log('info received', data));

socket.on('list', ({ data }) => console.log('list received', data));

socket.on('rec-started', ({ data }) => console.log('recording started', data));

socket.on('rec-stopped', ({ data }) => console.log('recording stopped', data));

socket.on('created', ({ data }) => console.log('mountpoint created', data));

socket.on('destroyed', ({ data }) => console.log('mountpoint destroyed', data));

function _setupDataChannelCallbacks(channel, isLocal) {
  const dcLogPrefix = `${isLocal ? 'Local' : 'Remote'} Datachannel ${channel.id} (${channel.label})`;

  channel.onopen = (_event) => {
    console.log(`${dcLogPrefix} open`);
  };

  channel.onmessage = (event) => {
    decoder = decoder || new TextDecoder(); // initialize the decoder
    let decodedData = event.data;
    if (event.data?.byteLength) { // is ArrayBuffer
      decodedData = decoder.decode(event.data);
    }
    console.log(`${dcLogPrefix} received`, decodedData);
  };

  channel.onclose = () => {
    console.log(`${dcLogPrefix} closed`);
  };

  channel.onerror = (error) => {
    console.error(`${dcLogPrefix} error`, error);
  };
}

async function doAnswer(offer) {
  if (!streamingPeerConnection) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
      //'sdpSemantics': 'unified-plan',
    });

    // inspect the offer.sdp for m=application lines before creating the DataChannel
    if (/m=application [1-9]\d*/.test(offer.sdp)) {
      const localChannel = pc.createDataChannel('JanusDataChannel');
      _setupDataChannelCallbacks(localChannel, true);

      pc.ondatachannel = (event) => {
        const remoteChannel = event.channel;
        _setupDataChannelCallbacks(remoteChannel, false);
      };
    }
    pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
    pc.onicecandidate = event => trickle({ candidate: event.candidate });
    pc.oniceconnectionstatechange = () => {
      console.log('pc.oniceconnectionstatechange => ' + pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        stopAllStreams();
        closePC();
      }
    };
    pc.ontrack = event => {
      console.log('pc.ontrack', event);

      event.track.onunmute = evt => {
        console.log('track.onunmute', evt);
        /* TODO set srcObject in this callback */
      };
      event.track.onmute = evt => {
        console.log('track.onmute', evt);
      };
      event.track.onended = evt => {
        console.log('track.onended', evt);
      };

      const remoteStream = event.streams[0];
      setVideoElement(remoteStream);
    };

    streamingPeerConnection = pc;
  }

  await streamingPeerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');
  const answer = await streamingPeerConnection.createAnswer();
  console.log('create answer OK');
  streamingPeerConnection.setLocalDescription(answer);
  console.log('set local sdp OK');
  return answer;
}

function setVideoElement(stream) {
  if (!stream) return;
  remoteVideo.srcObject = stream;
}

function stopAllStreams() {
  if (remoteVideo.srcObject) {
    console.log('stopping streams');
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
}

function closePC(pc = streamingPeerConnection) {
  if (!pc) return;
  console.log('stopping pc');
  pc.onnegotiationneeded = null;
  pc.onicecandidate = null;
  pc.oniceconnectionstatechange = null;
  pc.ontrack = null;
  pc.close();
  if (pc === streamingPeerConnection) streamingPeerConnection = null;
}
