/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

const pcMap = new Map();
let pendingOfferMap = new Map();
const myRoom = getURLParameter('room') ? parseInt(getURLParameter('room')) : (getURLParameter('room_str') || 1234);
const randName = ('John_Doe_' + Math.floor(10000 * Math.random()));
const myName = getURLParameter('name') || randName;
let myFeed;

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

async function _publish(feed = myFeed, display) {
  const offer = await doOffer(feed, display);
  configure({ feed: feed, jsep: offer });
}

function join({ room = myRoom, display = myName, token = null } = {}) {
  const joinData = {
    room,
    display,
    token,
  };

  socket.emit('join', {
    data: joinData,
    _id: getId(),
  });
}

function subscribe({ feed, room = myRoom, substream, temporal }) {
  const subscribeData = {
    room,
    feed,
  };

  if (typeof substream !== 'undefined') subscribeData.sc_substream_layer = substream;
  if (typeof temporal !== 'undefined') subscribeData.sc_temporal_layers = temporal;

  socket.emit('subscribe', {
    data: subscribeData,
    _id: getId(),
  });
}

function subscribeTo(peers, room = myRoom) {
  peers.forEach(({ feed }) => {
    subscribe({ feed, room });
  });
}

function trickle({ feed, candidate }) {
  const trickleData = candidate ? { candidate } : {};
  trickleData.feed = feed;
  const trickleEvent = candidate ? 'trickle' : 'trickle-complete';

  socket.emit(trickleEvent, {
    data: trickleData,
    _id: getId(),
  });
}

function configure({ feed, jsep, restart, substream, temporal }) {
  const configureData = {
    feed,
    audio: true,
    video: true,
    data: true,
  };
  if (typeof substream !== 'undefined') configureData.sc_substream_layer = substream;
  if (typeof temporal !== 'undefined') configureData.sc_temporal_layers = temporal;
  if (jsep) configureData.jsep = jsep;
  if (typeof restart === 'boolean') configureData.restart = restart;

  const configId = getId();

  socket.emit('configure', {
    data: configureData,
    _id: configId,
  });

  if (jsep) pendingOfferMap.set(configId, { feed });
}

function _unpublish({ feed = myFeed } = {}) {
  const unpublishData = {
    feed,
  };

  socket.emit('unpublish', {
    data: unpublishData,
    _id: getId(),
  });
}

function _leave({ feed = myFeed } = {}) {
  const leaveData = {
    feed,
  };

  socket.emit('leave', {
    data: leaveData,
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

function start({ feed, jsep = null }) {
  const startData = {
    feed,
    jsep,
  };

  socket.emit('start', {
    data: startData,
    _id: getId(),
  });
}

function _pause({ feed }) {
  const pauseData = {
    feed,
  };

  socket.emit('start', {
    data: pauseData,
    _id: getId(),
  });
}


function _switch({ from_feed, to_feed, audio = true, video = true, data = false }) {
  const switchData = {
    from_feed,
    to_feed,
    audio,
    video,
    data,
  };

  socket.emit('switch', {
    data: switchData,
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

function _create({ room, description, max_publishers = 6, audiocodec = 'opus', videocodec = 'vp8', talking_events = false, talking_level_threshold = 25, talking_packets_threshold = 100, permanent = false }) {
  socket.emit('create', {
    data: {
      room,
      description,
      max_publishers,
      audiocodec,
      videocodec,
      talking_events,
      talking_level_threshold,
      talking_packets_threshold,
      permanent,
    },
    _id: getId(),
  });
}

function _destroy({ room = myRoom, permanent = false, secret = 'adminpwd' }) {
  socket.emit('destroy', {
    data: {
      room,
      permanent,
      secret,
    },
    _id: getId(),
  });
}

// add remove enable disable token mgmt
function _allow({ room = myRoom, action, token, secret = 'adminpwd' }) {
  const allowData = {
    room,
    action,
    secret,
  };
  if (action != 'disable' && token) allowData.list = [token];

  socket.emit('allow', {
    data: allowData,
    _id: getId(),
  });
}

function _startForward({ feed = myFeed, room = myRoom, host = 'localhost', audio_port, video_port, data_port = null, secret = 'adminpwd' }) {
  socket.emit('rtp-fwd-start', {
    data: {
      room,
      feed,
      host,
      audio_port,
      video_port,
      data_port,
      secret,
    },
    _id: getId(),
  });
}

function _stopForward({ stream, feed = myFeed, room = myRoom, secret = 'adminpwd' }) {
  socket.emit('rtp-fwd-stop', {
    data: {
      room,
      stream,
      feed,
      secret,
    },
    _id: getId(),
  });
}

function _listForward({ room = myRoom, secret = 'adminpwd' } = {}) {
  socket.emit('rtp-fwd-list', {
    data: { room, secret },
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
  pendingOfferMap.clear();
  removeAllVideoElements();
  closeAllPCs();
});

socket.on('videoroom-error', ({ error, _id }) => {
  console.log('videoroom error', error);
  if (error === 'backend-failure' || error === 'session-not-available') {
    socket.disconnect();
    return;
  }
  if (pendingOfferMap.has(_id)) {
    const { feed } = pendingOfferMap.get(_id);
    removeVideoElementByFeed(feed);
    closePC(feed);
    pendingOfferMap.delete(_id);
    return;
  }
});

socket.on('joined', async ({ data }) => {
  console.log('joined to room', data);
  setLocalVideoElement(null, null, null, data.room);

  try {
    await _publish(data.feed, data.display);
    subscribeTo(data.publishers, data.room);
  } catch (e) {
    console.log('error while doing offer', e);
  }
});

socket.on('subscribed', async ({ data }) => {
  console.log('subscribed to feed', data);

  try {
    const answer = await doAnswer(data.feed, data.display, data.jsep);
    start({ feed: data.feed, jsep: answer });
  } catch (e) { console.log('error while doing answer', e); }
});

socket.on('participants-list', ({ data }) => {
  console.log('participants list', data);
});

socket.on('talking', ({ data }) => {
  console.log('talking notify', data);
});

socket.on('kicked', ({ data }) => {
  console.log('participant kicked', data);
  if (data.feed) {
    removeVideoElementByFeed(data.feed);
    closePC(data.feed);
  }
});

socket.on('allowed', ({ data }) => {
  console.log('token management', data);
});

socket.on('configured', async ({ data, _id }) => {
  console.log('feed configured', data);
  pendingOfferMap.delete(_id);
  const pc = pcMap.get(data.feed);
  if (pc && data.jsep) {
    try {
      await pc.setRemoteDescription(data.jsep);
      console.log('configure remote sdp OK');
      if (data.jsep.type === 'offer') {
        const answer = await doAnswer(data.feed, null, data.jsep);
        start(data.feed, answer);
      }
    } catch (e) {
      console.log('error setting remote sdp', e);
    }
  }
});

socket.on('display', ({ data }) => {
  console.log('feed changed display name', data);
  setRemoteVideoElement(null, data.feed, data.display);
});

socket.on('started', ({ data }) => {
  console.log('subscribed feed started', data);
});

socket.on('paused', ({ data }) => {
  console.log('feed paused', data);
});

socket.on('switched', ({ data }) => {
  console.log(`feed switched from ${data.from_feed} to ${data.to_feed} (${data.display})`);
  /* !!! This will actually break the DOM management since IDs are feed based !!! */
  setRemoteVideoElement(null, data.from_feed, data.display);
});

socket.on('feed-list', ({ data }) => {
  console.log('new feeds available!', data);
  subscribeTo(data.publishers, data.room);
});

socket.on('unpublished', ({ data }) => {
  console.log('feed unpublished', data);
  if (data.feed) {
    removeVideoElementByFeed(data.feed);
    closePC(data.feed);
  }
});

socket.on('leaving', ({ data }) => {
  console.log('feed leaving', data);
  if (data.feed) {
    removeVideoElementByFeed(data.feed);
    closePC(data.feed);
  }
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
  if (data.room === myRoom) {
    socket.disconnect();
  }
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

async function _restartPublisher(feed) {
  return await _publish(feed, null);
}

async function _restartSubscriber(feed) {
  configure({ feed, restart: true });
}

async function doOffer(feed, display) {
  if (!pcMap.has(feed)) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
    });

    pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
    pc.onicecandidate = event => trickle({ feed, candidate: event.candidate });
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removeVideoElementByFeed(feed);
        closePC(feed);
      }
    };
    /* This one below should not be fired, cause the PC is used just to send */
    pc.ontrack = event => console.log('pc.ontrack', event);

    pcMap.set(feed, pc);

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStream.getTracks().forEach(track => {
        console.log('adding track', track);
        pc.addTrack(track, localStream);
      });
      setLocalVideoElement(localStream, feed, display);
    } catch (e) {
      console.log('error while doing offer', e);
      removeVideoElementByFeed(feed);
      closePC(feed);
      return;
    }
  }
  else {
    console.log('Performing ICE restart');
    pcMap.get(feed).restartIce();
  }
  myFeed = feed;

  try {
    const pc = pcMap.get(feed);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log('set local sdp OK');
    return offer;
  } catch (e) {
    console.log('error while doing offer', e);
    removeVideoElementByFeed(feed);
    closePC(feed);
    return;
  }

}

async function doAnswer(feed, display, offer) {
  if (!pcMap.has(feed)) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
    });

    pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
    pc.onicecandidate = event => trickle({ feed, candidate: event.candidate });
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removeVideoElementByFeed(feed);
        closePC(feed);
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
      setRemoteVideoElement(remoteStream, feed, display);
    };

    pcMap.set(feed, pc);
  }

  const pc = pcMap.get(feed);

  try {
    await pc.setRemoteDescription(offer);
    console.log('set remote sdp OK');
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('set local sdp OK');
    return answer;
  } catch (e) {
    console.log('error creating subscriber answer', e);
    removeVideoElementByFeed(feed);
    closePC(feed);
    throw e;
  }
}

function setLocalVideoElement(localStream, feed, display, room) {
  if (room) document.getElementById('videos').getElementsByTagName('span')[0].innerHTML = '   --- VIDEOROOM (' + room + ') ---  ';
  if (!feed) return;

  if (!document.getElementById('video_' + feed)) {
    const nameElem = document.createElement('span');
    nameElem.innerHTML = display + ' (' + feed + ')';
    nameElem.style.display = 'table';

    if (localStream) {
      const localVideoStreamElem = document.createElement('video');
      //localVideo.id = 'video_'+feed;
      localVideoStreamElem.width = 320;
      localVideoStreamElem.height = 240;
      localVideoStreamElem.autoplay = true;
      localVideoStreamElem.muted = 'muted';
      localVideoStreamElem.style.cssText = '-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;';
      localVideoStreamElem.srcObject = localStream;

      const localVideoContainer = document.createElement('div');
      localVideoContainer.id = 'video_' + feed;
      localVideoContainer.appendChild(nameElem);
      localVideoContainer.appendChild(localVideoStreamElem);

      document.getElementById('locals').appendChild(localVideoContainer);
    }
  }
  else {
    const localVideoContainer = document.getElementById('video_' + feed);
    if (display) {
      const nameElem = localVideoContainer.getElementsByTagName('span')[0];
      nameElem.innerHTML = display + ' (' + feed + ')';
    }
    const localVideoStreamElem = localVideoContainer.getElementsByTagName('video')[0];
    if (localStream)
      localVideoStreamElem.srcObject = localStream;
  }
}

function setRemoteVideoElement(remoteStream, feed, display) {
  if (!feed) return;

  if (!document.getElementById('video_' + feed)) {
    const nameElem = document.createElement('span');
    nameElem.innerHTML = display + ' (' + feed + ')';
    nameElem.style.display = 'table';

    const remoteVideoStreamElem = document.createElement('video');
    remoteVideoStreamElem.width = 320;
    remoteVideoStreamElem.height = 240;
    remoteVideoStreamElem.autoplay = true;
    remoteVideoStreamElem.style.cssText = '-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;';
    if (remoteStream)
      remoteVideoStreamElem.srcObject = remoteStream;

    const remoteVideoContainer = document.createElement('div');
    remoteVideoContainer.id = 'video_' + feed;
    remoteVideoContainer.appendChild(nameElem);
    remoteVideoContainer.appendChild(remoteVideoStreamElem);

    document.getElementById('remotes').appendChild(remoteVideoContainer);
  }
  else {
    const remoteVideoContainer = document.getElementById('video_' + feed);
    if (display) {
      const nameElem = remoteVideoContainer.getElementsByTagName('span')[0];
      nameElem.innerHTML = display + ' (' + feed + ')';
    }
    if (remoteStream) {
      const remoteVideoStreamElem = remoteVideoContainer.getElementsByTagName('video')[0];
      remoteVideoStreamElem.srcObject = remoteStream;
    }
  }
}

function removeVideoElementByFeed(feed, stopTracks = true) {
  const videoContainer = document.getElementById(`video_${feed}`);
  if (videoContainer) removeVideoElement(videoContainer, stopTracks);
}

function removeVideoElement(container, stopTracks = true) {
  let videoStreamElem = container.getElementsByTagName('video').length > 0 ? container.getElementsByTagName('video')[0] : null;
  if (videoStreamElem && videoStreamElem.srcObject && stopTracks) {
    videoStreamElem.srcObject.getTracks().forEach(track => track.stop());
    videoStreamElem.srcObject = null;
  }
  container.remove();
}

function removeAllVideoElements() {
  const locals = document.getElementById('locals');
  const localVideoContainers = locals.getElementsByTagName('div');
  for (let i = 0; localVideoContainers && i < localVideoContainers.length; i++)
    removeVideoElement(localVideoContainers[i]);
  while (locals.firstChild)
    locals.removeChild(locals.firstChild);

  var remotes = document.getElementById('remotes');
  const remoteVideoContainers = remotes.getElementsByTagName('div');
  for (let i = 0; remoteVideoContainers && i < remoteVideoContainers.length; i++)
    removeVideoElement(remoteVideoContainers[i]);
  while (remotes.firstChild)
    remotes.removeChild(remotes.firstChild);
  document.getElementById('videos').getElementsByTagName('span')[0].innerHTML = '   --- VIDEOROOM () ---  ';
}

function _closePC(pc) {
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

function closePC(feed) {
  if (!feed) return;
  let pc = pcMap.get(feed);
  console.log('closing pc for feed', feed);
  _closePC(pc);
  pcMap.delete(feed);
}

function closeAllPCs() {
  console.log('closing all pcs');

  pcMap.forEach((pc, feed) => {
    console.log('closing pc for feed', feed);
    _closePC(pc);
  });

  pcMap.clear();
}
