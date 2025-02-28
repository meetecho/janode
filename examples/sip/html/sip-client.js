/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let sipPeerConnection;
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

const connButton = document.getElementById('connect');
connButton.onclick = () => {
  if (socket.connected)
    socket.disconnect();
  else
    socket.connect();
};

const callButton = document.getElementById('call');
callButton.onclick = async () => {
  if (!socket.connected) return;
  const uri = document.getElementById('callee').value;
  try {
    const offer = await doOffer();
    call(uri, offer);
  } catch (error) {
    console.log('error during setup/offer', error);
    stopAllStreams();
    closePC();
    return;
  }
};

const hangupButton = document.getElementById('hangup');
hangupButton.onclick = async () => {
  if (!socket.connected) return;
  hangup();
};

const declineButton = document.getElementById('decline');
declineButton.onclick = async () => {
  if (!socket.connected) return;
  decline();
};

let incoming = null;
const acceptButton = document.getElementById('accept');
acceptButton.onclick = async () => {
  if (!socket.connected || !incoming) return;
  const { offer, caller } = incoming;
  console.log('accepting call from', caller);
  incoming = null;
  try {
    const answer = await doAnswer(offer);
    accept(answer);
  } catch (error) {
    console.log('error during setup/answer', error);
    stopAllStreams();
    closePC();
    return;
  }
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
    console.log('scheduled register in ' + timeout + ' ms');
    task = setTimeout(() => {
      register();
      task = null;
    }, timeout);
  });
})();

const socket = io({
  rejectUnauthorized: false,
  autoConnect: false,
  reconnection: false,
});

function register() {
  if (!socket.connected) return;
  const type = document.getElementById('type').value.length > 0 ? document.getElementById('type').value : null;
  const username = document.getElementById('username').value;
  const secret = document.getElementById('secret').value;
  const proxy = document.getElementById('proxy').value;
  socket.emit('register', {
    data: {
      type,
      username,
      secret,
      proxy,
    },
    _id: getId()
  });
}

function call(uri, offer) {
  if (!socket.connected) return;
  socket.emit('call', {
    data: {
      uri,
      jsep: offer
    },
    _id: getId(),
  });
}

function accept(answer) {
  if (!socket.connected) return;
  socket.emit('accept', {
    data: {
      jsep: answer
    },
    _id: getId(),
  });
}

function hangup() {
  if (!socket.connected) return;
  socket.emit('hangup', {
    data: {},
    _id: getId(),
  });
}

function decline() {
  if (!socket.connected) return;
  socket.emit('decline', {
    data: {},
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

socket.on('registering', ({ data }) => {
  console.log('sip registering', data);
  document.getElementById('status').innerHTML = 'registering';
});

socket.on('registered', ({ data }) => {
  console.log('sip registered', data);
  document.getElementById('status').innerHTML = `registered (${data.username})`;
});


socket.on('calling', ({ data }) => {
  console.log('sip calling', data);
  document.getElementById('status').innerHTML = 'calling';
});

socket.on('ringing', ({ data }) => {
  console.log('sip ringing', data);
  document.getElementById('status').innerHTML = 'ringing';
});

socket.on('accepted', ({ data }) => {
  console.log('sip accepted', data);
  if (sipPeerConnection && data.jsep) {
    sipPeerConnection.setRemoteDescription(data.jsep)
      .then(() => console.log('remote sdp OK'))
      .catch(e => console.log('error setting remote sdp', e));
  }
  document.getElementById('status').innerHTML = `in call (${data.username})`;
});

socket.on('incoming', async ({ data }) => {
  console.log('sip incoming', data);
  if (data.jsep) {
    incoming = {
      offer: data.jsep,
      caller: data.username,
    };
  }
  document.getElementById('status').innerHTML = `incoming (${data.username})`;
});

socket.on('hangingup', ({ data }) => {
  console.log('sip hangingup', data);
  document.getElementById('status').innerHTML = 'hangingup';
});

socket.on('hangup', ({ data }) => {
  console.log('hangup', data);
  document.getElementById('status').innerHTML = 'hangup';
  stopAllStreams();
  closePC();
});

socket.on('declined', ({ data }) => {
  console.log('declined', data);
  document.getElementById('status').innerHTML = 'declined';
});

socket.on('missed', ({ data }) => {
  console.log('missed', data);
  document.getElementById('status').innerHTML = 'missed';
});

socket.on('info', ({ data }) => {
  console.log('info', data);
});

socket.on('dtmf', ({ data }) => {
  console.log('dtmf', data);
});

socket.on('sip-error', ({ error }) => {
  console.log('sip error', error);
  document.getElementById('status').innerHTML = 'error: ' + error;
  stopAllStreams();
  closePC();
  //socket.disconnect();
});

socket.on('connect', () => {
  console.log('socket connected');
  document.getElementById('status').innerHTML = 'connected';
  connButton.innerText = 'DISCONNECT';
  socket.sendBuffer = [];
  scheduleConnection(0.1);
});

socket.on('disconnect', () => {
  console.log('socket disconnected');
  document.getElementById('status').innerHTML = 'disconnected';
  connButton.innerText = 'CONNECT';
  stopAllStreams();
  closePC();
});

async function doOffer() {
  const pc = new RTCPeerConnection({
    'iceServers': [{
      urls: 'stun:stun.l.google.com:19302'
    }],
  });
  sipPeerConnection = pc;

  pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
  pc.onicecandidate = event => trickle({ candidate: event.candidate });
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
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
    setRemoteAudioElement(remoteStream);
  };

  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  console.log('getUserMedia OK');

  setLocalAudioElement(localStream);

  localStream.getTracks().forEach(track => {
    console.log('adding track', track);
    pc.addTrack(track, localStream);
  });


  const offer = await sipPeerConnection.createOffer();
  console.log('create offer OK');
  await sipPeerConnection.setLocalDescription(offer);
  console.log('set local sdp OK');
  return offer;
}

async function doAnswer(offer) {
  const pc = new RTCPeerConnection({
    'iceServers': [{
      urls: 'stun:stun.l.google.com:19302'
    }],
  });
  sipPeerConnection = pc;

  pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
  pc.onicecandidate = event => trickle({ candidate: event.candidate });
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
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
    setRemoteAudioElement(remoteStream);
  };

  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  console.log('getUserMedia OK');

  setLocalAudioElement(localStream);

  localStream.getTracks().forEach(track => {
    console.log('adding track', track);
    pc.addTrack(track, localStream);
  });

  await sipPeerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');
  const answer = await sipPeerConnection.createAnswer();
  console.log('create answer OK');
  await pc.setLocalDescription(answer);
  console.log('set local sdp OK');
  return answer;
}

function setLocalAudioElement(stream) {
  if (stream) {
    const audioStreamElem = document.getElementById('localAudio');
    audioStreamElem.autoplay = false;
    audioStreamElem.srcObject = stream;
  }
}

function setRemoteAudioElement(stream) {
  if (stream) {
    const audioStreamElem = document.getElementById('remoteAudio');
    audioStreamElem.autoplay = true;
    audioStreamElem.srcObject = stream;
  }
}

function stopAllStreams() {
  incoming = null;
  if (localAudio.srcObject) {
    localAudio.srcObject.getTracks().forEach(track => track.stop());
    localAudio.srcObject = null;
  }
  if (remoteAudio.srcObject) {
    remoteAudio.srcObject.getTracks().forEach(track => track.stop());
    remoteAudio.srcObject = null;
  }
}

function closePC(pc = sipPeerConnection) {
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