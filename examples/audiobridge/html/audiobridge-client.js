/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let audioPeerConnection;
let pendingOfferMap = new Map();
const myRoom = getURLParameter('room') ? parseInt(getURLParameter('room')) : (getURLParameter('room_str') || 1234);
const randName = ('John_Doe_' + Math.floor(10000 * Math.random()));
const myName = getURLParameter('name') || randName;
let myFeed;
const skipJoin = getURLParameter('skipjoin') || false;
const skipOffer = getURLParameter('skipoffer') || false;

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
    console.log('scheduled joining in ' + timeout + ' ms');
    task = setTimeout(() => {
      join();
      task = null;
    }, timeout);
  });
})();

const socket = io({
  rejectUnauthorized: false,
  autoConnect: false,
  reconnection: false,
});

function join({ room = myRoom, display = myName, muted = false, suspended = false, token = null, rtp_participant = null, group = null } = {}) {
  const joinData = {
    room,
    display,
    muted,
    suspended,
    token,
    rtp_participant,
    group,
  };

  socket.emit('join', {
    data: joinData,
    _id: getId(),
  });
}

function _listParticipants({ room = myRoom } = {}) {
  const listData = {
    room,
  };

  socket.emit('list-participants', {
    data: listData,
    _id: getId(),
  });
}

function _kick({ feed, room = myRoom, secret = 'adminpwd' }) {
  const kickData = {
    room,
    feed,
    secret,
  };

  socket.emit('kick', {
    data: kickData,
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

function configure({ display, muted, record, filename, bitrate, expected_loss, group, jsep }) {
  const configureData = {};
  const configureId = getId();

  if (display) configureData.display = display;
  if (typeof muted === 'boolean') configureData.muted = muted;
  if (typeof record === 'boolean') configureData.record = record;
  if (filename) configureData.filename = filename;
  if (typeof bitrate === 'number') configureData.bitrate = bitrate;
  if (typeof expected_loss === 'number') configureData.expected_loss = expected_loss;
  if (group) configureData.group = group;
  if (jsep) {
    configureData.jsep = jsep;
    pendingOfferMap.set(configureId, null);
  }

  socket.emit('configure', {
    data: configureData,
    _id: configureId,
  });
}

function _leave({ feed }) {
  const leaveData = {
    feed,
  };

  socket.emit('leave', {
    data: leaveData,
    _id: getId(),
  });
}

function _exists({ room = myRoom } = {}) {
  const existsData = {
    room,
  };

  socket.emit('exists', {
    data: existsData,
    _id: getId(),
  });
}

function _listRooms() {
  socket.emit('list-rooms', {
    _id: getId(),
  });
}

function _create({ room, description, permanent = false, pin = null, secret = null, allow_rtp = true, bitrate = 0, expected_loss = 0, talking_events = false, talking_level_threshold = 25, talking_packets_threshold = 100, groups } = {}) {
  socket.emit('create', {
    data: {
      room,
      description,
      permanent,
      allow_rtp,
      bitrate,
      expected_loss,
      talking_events,
      talking_level_threshold,
      talking_packets_threshold,
      groups,
      pin,
      secret,
    },
    _id: getId(),
  });
}

function _destroy({ room = myRoom, permanent = false, secret = 'adminpwd' } = {}) {
  // options = {room: number, permanent: bool, secret: string}
  socket.emit('destroy', {
    data: {
      room,
      permanent,
      secret,
    },
    _id: getId(),
  });
}

function _enableRecording({ room = myRoom, record, filename = null, secret = 'adminpwd' }) {
  const recData = {
    room,
    secret,
    record,
  };
  if (filename) recData.filename = filename;

  socket.emit('enable-recording', {
    data: recData,
    _id: getId(),
  });
}

// add remove enable disable token mgmt
function _allow({ room = myRoom, action, token = null, secret = 'adminpwd' }) {
  const allowData = {
    room,
    secret,
    action,
  };
  if (action !== 'disable' && token) allowData.list = [token];

  socket.emit('allow', {
    data: allowData,
    _id: getId(),
  });
}

function _startForward({ room = myRoom, host = 'localhost', audio_port, group = null, secret = 'adminpwd' }) {
  let startData = {
    room,
    host,
    audio_port,
    group,
    secret,
  };

  socket.emit('rtp-fwd-start', {
    data: startData,
    _id: getId(),
  });
}

function _stopForward({ room = myRoom, stream, secret = 'adminpwd' }) {
  let stopData = {
    room,
    stream,
    secret,
  };

  socket.emit('rtp-fwd-stop', {
    data: stopData,
    _id: getId(),
  });
}

function _listForward({ room = myRoom, secret = 'adminpwd' } = {}) {
  let listData = {
    room,
    secret,
  };

  socket.emit('rtp-fwd-list', {
    data: listData,
    _id: getId(),
  });
}

function _mutePeer({ room = myRoom, feed = myFeed, secret = 'adminpwd' } = {}) {
  let muteData = {
    room,
    feed,
    secret,
  };

  socket.emit('mute-peer', {
    data: muteData,
    _id: getId(),
  });
}

function _unmutePeer({ room = myRoom, feed = myFeed, secret = 'adminpwd' } = {}) {
  let unmuteData = {
    room,
    feed,
    secret,
  };

  socket.emit('unmute-peer', {
    data: unmuteData,
    _id: getId(),
  });
}

function _muteRoom({ room = myRoom, secret = 'adminpwd' } = {}) {
  let muteData = {
    room,
    secret,
  };

  socket.emit('mute-room', {
    data: muteData,
    _id: getId(),
  });
}

function _unmuteRoom({ room = myRoom, secret = 'adminpwd' } = {}) {
  let unmuteData = {
    room,
    secret,
  };

  socket.emit('unmute-room', {
    data: unmuteData,
    _id: getId(),
  });
}

function _suspend({ room = myRoom, feed = myFeed, stop_record = false, secret = 'adminpwd' } = {}) {
  let suspendData = {
    room,
    feed,
    stop_record,
    secret,
  };

  socket.emit('suspend-peer', {
    data: suspendData,
    _id: getId(),
  });
}

function _resume({ room = myRoom, feed = myFeed, record = false, filename, secret = 'adminpwd' } = {}) {
  let resumeData = {
    room,
    feed,
    record,
    secret,
  };
  if (filename) resumeData.filename = filename;

  socket.emit('resume-peer', {
    data: resumeData,
    _id: getId(),
  });
}

socket.on('connect', () => {
  console.log('socket connected');
  socket.sendBuffer = [];
  if (skipJoin) return;
  scheduleConnection(0.1);
});

socket.on('disconnect', () => {
  console.log('socket disconnected');
  pendingOfferMap.clear();
  removeAllAudioElements();
  closePC();
});

socket.on('audiobridge-error', ({ error, _id }) => {
  console.log('audiobridge error', error);
  if (error === 'backend-failure' || error === 'session-not-available') {
    socket.disconnect();
    return;
  }
  if (pendingOfferMap.has(_id)) {
    pendingOfferMap.delete(_id);
    removeAllAudioElements();
    closePC();
    return;
  }
});

socket.on('joined', async ({ data }) => {
  console.log('you have joined to room', data);
  myFeed = data.feed;
  removeAllAudioElements();
  closePC();
  setAudioElement(null, data.feed, data.display, data.room);

  if (!skipOffer) {
    try {
      const offer = await doOffer(data.feed);
      configure({ jsep: offer });
    } catch (error) {
      console.log('error during audiobridge setup/offer', error);
      removeAllAudioElements();
      closePC();
      return;
    }
  }

  data.participants.forEach(({ feed, display }) => setAudioElement(null, feed, display));
});

socket.on('peer-joined', ({ data }) => {
  console.log('peer joined to room', data);
  setAudioElement(null, data.feed, data.display);
});

socket.on('participants-list', ({ data }) => {
  console.log('participants list', data);
});

socket.on('kicked', ({ data }) => {
  console.log('you have been kicked out', data);
  closePC();
  removeAllAudioElements();
});

socket.on('peer-kicked', ({ data }) => {
  console.log('participant kicked out', data);
  removeAudioElement(data.feed);
});

socket.on('configured', ({ data, _id }) => {
  console.log('feed configured', data);
  if (data.feed && data.display) {
    setAudioElement(null, data.feed, data.display);
  }
  pendingOfferMap.delete(_id);
  if (audioPeerConnection && data.jsep) {
    audioPeerConnection.setRemoteDescription(data.jsep)
      .then(() => console.log('remote sdp OK'))
      .catch(e => console.log('error setting remote sdp', e));
  }
});

socket.on('peer-configured', ({ data }) => {
  console.log('peer configured', data);
  setAudioElement(null, data.feed, data.display);
});

socket.on('leaving', ({ data }) => {
  console.log('own feed leaving', data);
  removeAllAudioElements();
  closePC();
});

socket.on('peer-leaving', ({ data }) => {
  console.log('peer feed leaving', data);
  removeAudioElement(data.feed);
});

socket.on('talking', ({ data }) => {
  console.log('own talking notify', data);
});

socket.on('peer-talking', ({ data }) => {
  console.log('peer talking notify', data);
});

socket.on('peer-suspended', ({ data }) => {
  console.log('peer suspended notify', data);
});

socket.on('peer-resumed', ({ data }) => {
  console.log('peer resumed notify', data);
});

socket.on('exists', ({ data }) => {
  console.log('room exists', data);
});

socket.on('rooms-list', ({ data }) => {
  console.log('rooms list', data);
});

socket.on('created', ({ data }) => {
  console.log('room created', data);
});

socket.on('destroyed', ({ data }) => {
  console.log('room destroyed', data);
  pendingOfferMap.clear();
  removeAllAudioElements();
  closePC();
});

socket.on('recording-status', ({ data }) => {
  console.log('recording status', data);
});

socket.on('allowed', ({ data }) => {
  console.log('token management', data);
});

socket.on('rtp-fwd-started', ({ data }) => {
  console.log('rtp forwarding started', data);
});

socket.on('rtp-fwd-stopped', ({ data }) => {
  console.log('rtp forwarding stopped', data);
});

socket.on('rtp-fwd-list', ({ data }) => {
  console.log('rtp forwarders list', data);
});

socket.on('peer-muted', ({ data }) => {
  console.log('peer muted', data);
});

socket.on('peer-unmuted', ({ data }) => {
  console.log('peer unmuted', data);
});

socket.on('room-muted', ({ data }) => {
  console.log('room muted', data);
});

socket.on('room-unmuted', ({ data }) => {
  console.log('room unmuted', data);
});

socket.on('room-muted-update', ({ data }) => {
  console.log('room muted update', data);
});

async function _restartParticipant() {
  const offer = await doOffer();
  configure({ jsep: offer });
}

async function doOffer(feed) {
  if (!audioPeerConnection) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
    });

    audioPeerConnection = pc;

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
      setAudioElement(remoteStream, feed, myName);
    };

    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    console.log('getUserMedia OK');

    localStream.getTracks().forEach(track => {
      console.log('adding track', track);
      pc.addTrack(track, localStream);
    });
  }
  else {
    console.log('Performing ICE restart');
    audioPeerConnection.restartIce();
  }

  const offer = await audioPeerConnection.createOffer();
  console.log('create offer OK');
  await audioPeerConnection.setLocalDescription(offer);
  console.log('set local sdp OK');
  return offer;
}

function setAudioElement(stream, feed, display, room) {
  if (room) document.getElementById('audios').getElementsByTagName('span')[0].innerHTML = '   --- AUDIOBRIDGE (' + room + ') ---  ';
  if (!feed) return;
  let audioContainerExists = (document.getElementById('audio_' + feed) != null);

  let audioContainer;
  if (!audioContainerExists) {
    audioContainer = document.createElement('div');
    audioContainer.id = 'audio_' + feed;
    audioContainer.appendChild(document.createElement('br'));
    const nameElem = document.createElement('span');
    nameElem.style.display = 'table';
    audioContainer.appendChild(nameElem);
    document.getElementById('participants').appendChild(audioContainer);
  }
  else {
    audioContainer = document.getElementById('audio_' + feed);
  }

  if (stream) {
    const audioStreamElemExists = (typeof audioContainer.getElementsByTagName('audio')[0] !== 'undefined');
    const audioStreamElem = audioStreamElemExists ? audioContainer.getElementsByTagName('audio')[0] : document.createElement('audio');
    if (!audioStreamElemExists) audioContainer.appendChild(audioStreamElem);
    audioStreamElem.autoplay = true;
    audioStreamElem.srcObject = stream;
  }

  if (display) {
    audioContainer.getElementsByTagName('span')[0].innerHTML = ' --- ' + display + ' (' + feed + ')';
  }
}

function removeAudioElement(feed) {
  if (!feed) return;
  const audioContainer = document.getElementById('audio_' + feed);
  if (audioContainer) {
    const audioStreamElem = audioContainer.getElementsByTagName('audio')[0];
    if (audioStreamElem) {
      audioStreamElem.srcObject = null;
    }
    audioContainer.remove();
  }
}

function removeAllAudioElements() {
  const participants = document.getElementById('participants');
  let audioContainers = participants.getElementsByTagName('div');
  for (let i = 0; i < audioContainers.length; i++) {
    const audioContainer = audioContainers[i];
    const audioStreamElem = audioContainer.getElementsByTagName('audio')[0];
    if (audioStreamElem && audioStreamElem.srcObject) {
      audioStreamElem.srcObject.getTracks().forEach(track => track.stop());
      audioStreamElem.srcObject = null;
    }
    audioContainer.remove();
  }
  while (participants.firstChild) {
    participants.removeChild(participants.firstChild);
  }
  document.getElementById('audios').getElementsByTagName('span')[0].innerHTML = '   --- AUDIOBRIDGE () ---  ';
}

function closePC(pc = audioPeerConnection) {
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
  if (pc === audioPeerConnection) audioPeerConnection = null;
}