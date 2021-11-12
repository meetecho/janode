/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let echoPeerConnection;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

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

const scheduleConnection = (function () {
  let task = null;
  const delay = 5000;

  return (function (secs) {
    if (task) return;
    const timeout = secs * 1000 || delay;
    console.log('scheduled starting in ' + timeout + ' ms');
    task = setTimeout(() => {
      start();
      task = null;
    }, timeout);
  });
})();

const socket = io({
  rejectUnauthorized: false,
  autoConnect: false,
  reconnection: false,
});

function start() {
  socket.emit('start', {
    _id: getId()
  });
}

function sendOffer(audio, video, bitrate, jsep) {
  const offer = {
    audio,
    video,
    record: false,
  };
  if (bitrate) offer.bitrate = bitrate;
  if (jsep) offer.jsep = jsep;

  socket.emit('offer', {
    data: offer,
    _id: getId(),
  });
}

function trickle(candidate) {
  const trickleData = candidate ? { candidate } : {};
  const trickleEvent = candidate ? 'trickle' : 'trickle-complete';

  socket.emit(trickleEvent, {
    data: trickleData,
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

socket.on('echo-error', ({ error }) => {
  console.log('echotest error', error);
  socket.disconnect();
});

socket.on('ready', async ({ data }) => {
  console.log('ready received', data);
  stopAllStreams();
  closePC();
  try {
    const offer = await doOffer();
    sendOffer(true, true, 512000, offer);
  } catch (e) {
    console.log('error during echotest setup/offer', e);
    stopAllStreams();
    closePC();
  }
});

socket.on('answer', async ({ data }) => {
  console.log('answer received', data);
  if (data.jsep) {
    try {
      await echoPeerConnection.setRemoteDescription(data.jsep);
      console.log('set remote sdp OK');
    } catch (e) {
      console.log('error setting remote sdp', e);
      stopAllStreams();
      closePC();
    }
  }
});

socket.on('result', ({ data }) => console.log('result received', data));

async function doOffer() {
  const pc = new RTCPeerConnection({
    'iceServers': [{
      urls: 'stun:stun.l.google.com:19302'
    }],
    //'sdpSemantics': 'unified-plan',
  });

  echoPeerConnection = pc;

  pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
  pc.onicecandidate = event => trickle(event.candidate);
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
      closePC(pc);
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
    remoteVideo.srcObject = remoteStream;
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

  console.log('getUserMedia OK');

  stream.getTracks().forEach(track => {
    console.log('adding track', track);
    pc.addTrack(track, stream);
  });

  localVideo.srcObject = stream;

  const offer = await echoPeerConnection.createOffer();
  console.log('create offer OK');
  await echoPeerConnection.setLocalDescription(offer);
  console.log('set local sdp OK');
  return offer;
}

function stopAllStreams() {
  if (localVideo.srcObject) {
    localVideo.srcObject.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
  }
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
}

function closePC(pc = echoPeerConnection) {
  if (!pc) return;
  pc.getSenders().forEach(sender => {
    if (sender.track)
      sender.track.stop();
  });
  pc.getReceivers().forEach(receiver => {
    if (receiver.track)
      receiver.track.stop();
  });
  pc.onnegotiationneeded = null;
  pc.onicecandidate = null;
  pc.oniceconnectionstatechange = null;
  pc.ontrack = null;
  pc.close();
}