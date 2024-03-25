/* eslint-disable no-sparse-arrays */
/* global io */

'use strict';

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let pubPc, subPc;
const subscriptions = new Map();
const pendingOfferMap = new Map();
const myRoom = getURLParameter('room') ? parseInt(getURLParameter('room')) : (getURLParameter('room_str') || 1234);
const randName = ('John_Doe_' + Math.floor(10000 * Math.random()));
const myName = getURLParameter('name') || randName;

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

function subscribe({ streams, room = myRoom }) {
  const subscribeData = {
    room,
    streams,
  };

  socket.emit('subscribe', {
    data: subscribeData,
    _id: getId(),
  });
}

function subscribeTo(publishers, room = myRoom) {
  const newStreams = [];
  publishers.forEach(({ feed, streams }) => {
    streams.forEach(s => {
      const mid = s.mid;
      if (!subscriptions.has(feed)) {
        subscriptions.set(feed, new Map());
      }
      const feedSubs = subscriptions.get(feed);
      if (!feedSubs.has(mid)) {
        feedSubs.set(mid, s);
        newStreams.push({
          feed,
          mid,
        });
      }
    });
  });

  if (newStreams.length > 0) {
    subscribe({
      streams: newStreams,
      room,
    });
  }
}

function trickle({ feed, candidate }) {
  const trickleData = candidate ? { candidate } : {};
  if (feed) trickleData.feed = feed;
  const trickleEvent = candidate ? 'trickle' : 'trickle-complete';

  socket.emit(trickleEvent, {
    data: trickleData,
    _id: getId(),
  });
}

function configure({ feed, display, jsep, restart, streams }) {
  const configureData = {};
  if (feed) configureData.feed = feed;
  if (display) configureData.display = display;
  if (jsep) configureData.jsep = jsep;
  if (streams) configureData.streams = streams;
  if (typeof restart === 'boolean') configureData.restart = restart;

  const configId = getId();

  socket.emit('configure', {
    data: configureData,
    _id: configId,
  });

  if (jsep)
    pendingOfferMap.set(configId, { feed });
}

function _unpublish({ feed = pubPc._feed }) {
  const unpublishData = {
    feed,
  };

  socket.emit('unpublish', {
    data: unpublishData,
    _id: getId(),
  });
}

function _leave({ feed = pubPc._feed }) {
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

function start({ jsep = null } = {}) {
  const startData = {
    jsep,
  };

  socket.emit('start', {
    data: startData,
    _id: getId(),
  });
}

function _pause() {
  const pauseData = {};

  socket.emit('pause', {
    data: pauseData,
    _id: getId(),
  });
}


function _switch({ streams }) {
  const switchData = {
    streams,
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

function _startForward({ feed, room = myRoom, host = 'localhost', audio_port, video_port, data_port = null, secret = 'adminpwd' }) {
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

function _stopForward({ stream, feed, room = myRoom, secret = 'adminpwd' }) {
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

function _listForward({ room = myRoom, secret = 'adminpwd' }) {
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
  subscriptions.clear();
  removeAllMediaElements();
  closeAllPCs();
});

socket.on('videoroom-error', ({ error, _id }) => {
  console.log('videoroom error', error);
  if (error === 'backend-failure' || error === 'session-not-available') {
    socket.disconnect();
    return;
  }
  if (pendingOfferMap.has(_id)) {
    removeLocalMediaElements();
    closePubPc();
    pendingOfferMap.delete(_id);
    return;
  }
});

socket.on('joined', async ({ data }) => {
  console.log('joined to room', data);
  setLocalMediaElement(null, null, null, data.room);

  try {
    const offer = await doOffer(data.feed, data.display);
    configure({ feed: data.feed, jsep: offer });
    subscribeTo(data.publishers, data.room);
  } catch (e) {
    console.log('error while doing offer', e);
  }
});

socket.on('subscribed', async ({ data }) => {
  console.log('subscribed to feed', data);

  try {
    if (data.jsep) {
      const answer = await doAnswer(data.streams, data.jsep);
      start({ jsep: answer });
    }
  } catch (e) { console.log('error while doing answer', e); }
});

socket.on('updated', async ({ data }) => {
  console.log('updated subscription', data);

  try {
    if (data.jsep) {
      const answer = await doAnswer(data.streams, data.jsep);
      start({ jsep: answer });
    }
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
    removeMediaElementsByFeed(data.feed, false);
    subscriptions.delete(data.feed);
    if (data.feed === pubPc?._feed) {
      closePubPc();
      subscriptions.clear();
    }
  }
});

socket.on('allowed', ({ data }) => {
  console.log('token management', data);
});

socket.on('configured', async ({ data, _id }) => {
  console.log('feed configured', data);
  pendingOfferMap.delete(_id);
  const pc = data.feed ? pubPc : subPc;
  if (pc && data.jsep) {
    try {
      await pc.setRemoteDescription(data.jsep);
      console.log('configure remote sdp OK');
      if (data.jsep.type === 'offer') {
        const answer = await doAnswer(data.streams, data.jsep);
        start({ jsep: answer });
      }
    } catch (e) {
      console.log('error setting remote sdp', e);
    }
    return;
  }
  if (data.display) {
    setLocalMediaElement(null, data.feed, data.display);
    return;
  }
});

socket.on('display', ({ data }) => {
  console.log('feed changed display name', data);
  setRemoteVideoElement(null, data.feed, null, data.display);

});

socket.on('started', ({ data }) => {
  console.log('subscriber feed started', data);
});

socket.on('paused', ({ data }) => {
  console.log('feed paused', data);
});

socket.on('switched', ({ data }) => {
  console.log('feed switched', data);
  //TODO
});

socket.on('feed-list', ({ data }) => {
  console.log('new feeds available!', data);
  subscribeTo(data.publishers, data.room);
});

socket.on('unpublished', ({ data }) => {
  console.log('feed unpublished', data);
  if (data.feed) {
    removeMediaElementsByFeed(data.feed, false);
    subscriptions.delete(data.feed);
    if (data.feed === pubPc?._feed) {
      closePubPc();
      subscriptions.clear();
    }
  }
});

socket.on('leaving', ({ data }) => {
  console.log('feed leaving', data);
  if (data.feed) {
    removeMediaElementsByFeed(data.feed, false);
    subscriptions.delete(data.feed);
    if (data.feed === pubPc?._feed) {
      closePubPc();
      subscriptions.clear();
    }
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
  const offer = await doOffer(feed, null);
  configure({ feed, jsep: offer });
}

async function _restartSubscriber() {
  configure({ restart: true });
}

async function doOffer(feed, display) {
  if (!pubPc) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
    });

    pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
    pc.onicecandidate = event => trickle({ feed, candidate: event.candidate });
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removeLocalMediaElements();
        closePubPc();
      }
    };
    /* This one below should not be fired, cause the PC is used just to send */
    pc.ontrack = event => console.log('pc.ontrack', event);

    pubPc = pc;

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStream.getTracks().forEach(track => {
        console.log('adding track', track);
        pc.addTrack(track, localStream);
      });
      setLocalMediaElement(localStream, feed, display, null);
    } catch (e) {
      console.log('error while doing offer', e);
      removeLocalMediaElements();
      closePubPc();
      return;
    }
  }
  else {
    console.log('Performing ICE restart');
    pubPc.restartIce();
  }
  pubPc._feed = feed;

  try {
    const offer = await pubPc.createOffer();
    await pubPc.setLocalDescription(offer);
    console.log('set local sdp OK');
    return offer;
  } catch (e) {
    console.log('error while doing offer', e);
    removeLocalMediaElements();
    closePubPc();
    return;
  }

}

async function doAnswer(streams, offer) {
  if (!subPc) {
    const pc = new RTCPeerConnection({
      'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
      }],
    });

    subPc = pc;

    pc.onnegotiationneeded = event => console.log('pc.onnegotiationneeded', event);
    pc.onicecandidate = event => trickle({ candidate: event.candidate });
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removeRemoteMediaElements();
        closeSubPc();
      }
    };
    pc.ontrack = event => {
      console.log('pc.ontrack', event);

      event.track.onunmute = evt => {
        console.log('track.onunmute', evt);
      };
      event.track.onmute = evt => {
        console.log('track.onmute', evt);
      };
      event.track.onended = evt => {
        console.log('track.onended', evt);
      };

      const submid = event.transceiver?.mid || event.receiver.mid;
      const stream = subPc._streams.filter(({ mid }) => mid === submid)[0];
      const feed = stream.feed_id;
      const display = stream.feed_display;
      const type = stream.type;
      /* avoid latching tracks */
      const remoteStream = event.streams[0].id === 'janus' ? (new MediaStream([event.track])) : event.streams[0];
      if (type === 'video')
        setRemoteVideoElement(remoteStream, feed, submid, display);
      if (type === 'audio')
        setRemoteAudioElement(remoteStream, feed, submid);
    };
  }
  subPc._streams = streams;

  try {
    await subPc.setRemoteDescription(offer);
    console.log('set remote sdp OK');
    const answer = await subPc.createAnswer();
    await subPc.setLocalDescription(answer);
    console.log('set local sdp OK');
    return answer;
  } catch (e) {
    console.log('error creating subscriber answer', e);
    removeRemoteMediaElements();
    closeSubPc();
    throw e;
  }
}

function setLocalMediaElement(localStream, feed, display, room) {
  if (room) document.getElementById('videos').getElementsByTagName('span')[0].innerHTML = '   --- VIDEOROOM (' + room + ') ---  ';
  if (!feed) return;

  const id = `video_${feed}_local`;
  let localVideoContainer = document.getElementById(id);
  if (!localVideoContainer) {
    const nameElem = document.createElement('span');
    nameElem.style.display = 'table';

    const localVideoStreamElem = document.createElement('video');
    localVideoStreamElem.width = 320;
    localVideoStreamElem.height = 240;
    localVideoStreamElem.autoplay = true;
    localVideoStreamElem.muted = true;
    localVideoStreamElem.style.cssText = '-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;';

    localVideoContainer = document.createElement('div');
    localVideoContainer.id = id;
    localVideoContainer.appendChild(nameElem);
    localVideoContainer.appendChild(localVideoStreamElem);

    document.getElementById('locals').appendChild(localVideoContainer);
  }
  if (display) {
    const nameElem = localVideoContainer.getElementsByTagName('span')[0];
    nameElem.innerHTML = `${display}|${feed}`;
  }
  if (localStream) {
    const localVideoStreamElem = localVideoContainer.getElementsByTagName('video')[0];
    localVideoStreamElem.srcObject = localStream;
  }
}

function setRemoteVideoElement(remoteStream, feed, mid, display) {
  if (!feed) return;

  /* Target all streams related to feed */
  if (!remoteStream && !mid && display) {
    const videoIdStartsWith = `video_${feed}`;
    const videoContainers = document.querySelectorAll(`[id^=${videoIdStartsWith}]`);
    videoContainers.forEach(container => {
      if (remoteStream) {
        const remoteVideoStreamElem = container.getElementsByTagName('video')[0];
        remoteVideoStreamElem.srcObject = remoteStream;
      }
      if (display) {
        const nameElem = container.getElementsByTagName('span')[0];
        mid = nameElem.innerHTML.split('|')[2];
        nameElem.innerHTML = `${display}|${feed}|${mid}`;
      }
    });
    return;
  }

  /* Target specific feed/mid */
  const id = `video_${feed}_${mid}_remote`;
  let remoteVideoContainer = document.getElementById(id);
  if (!remoteVideoContainer) {
    /* Non existing */
    const nameElem = document.createElement('span');
    nameElem.innerHTML = `${display}|${feed}|${mid}`;
    nameElem.style.display = 'table';

    const remoteVideoStreamElem = document.createElement('video');
    remoteVideoStreamElem.width = 320;
    remoteVideoStreamElem.height = 240;
    remoteVideoStreamElem.autoplay = true;
    remoteVideoStreamElem.style.cssText = '-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;';

    remoteVideoContainer = document.createElement('div');
    remoteVideoContainer.id = id;
    remoteVideoContainer.appendChild(nameElem);
    remoteVideoContainer.appendChild(remoteVideoStreamElem);

    document.getElementById('remotes').appendChild(remoteVideoContainer);
  }
  if (display) {
    const nameElem = remoteVideoContainer.getElementsByTagName('span')[0];
    nameElem.innerHTML = `${display}|${feed}|${mid}`;
  }
  if (remoteStream) {
    const remoteVideoStreamElem = remoteVideoContainer.getElementsByTagName('video')[0];
    remoteVideoStreamElem.srcObject = remoteStream;
  }
}

function setRemoteAudioElement(remoteStream, feed, mid) {
  if (!feed) return;

  /* Target all streams related to feed */
  if (!remoteStream && !mid) {
    const audioIdStartsWith = `audio_${feed}`;
    const audioContainers = document.querySelectorAll(`[id^=${audioIdStartsWith}]`);
    audioContainers.forEach(container => {
      if (remoteStream) {
        const remoteAudioStreamElem = container.getElementsByTagName('audio')[0];
        remoteAudioStreamElem.srcObject = remoteStream;
      }
    });
    return;
  }

  const id = `audio_${feed}_${mid}_remote`;
  let remoteAudioContainer = document.getElementById(id);
  if (!remoteAudioContainer) {
    const remoteAudioStreamElem = document.createElement('audio');
    remoteAudioStreamElem.autoplay = true;

    remoteAudioContainer = document.createElement('div');
    remoteAudioContainer.id = id;
    remoteAudioContainer.appendChild(remoteAudioStreamElem);

    document.getElementById('remotes').appendChild(remoteAudioContainer);
  }
  if (remoteStream) {
    const remoteAudioStreamElem = remoteAudioContainer.getElementsByTagName('audio')[0];
    remoteAudioStreamElem.srcObject = remoteStream;
  }
}

function removeMediaElement(container, stopTracks = true) {
  let streamElem = null;
  if (container.getElementsByTagName('video').length > 0)
    streamElem = container.getElementsByTagName('video')[0];
  if (container.getElementsByTagName('audio').length > 0)
    streamElem = container.getElementsByTagName('audio')[0];
  if (streamElem && streamElem.srcObject && stopTracks) {
    streamElem.srcObject.getTracks().forEach(track => track.stop());
    streamElem.srcObject = null;
  }
  container.remove();
}

function removeMediaElementsByFeed(feed, stopTracks) {
  const audioIdStartsWith = `audio_${feed}`;
  const audioContainers = document.querySelectorAll(`[id^=${audioIdStartsWith}]`);
  audioContainers.forEach(container => removeMediaElement(container, stopTracks));

  const videoIdStartsWith = `video_${feed}`;
  const videoContainers = document.querySelectorAll(`[id^=${videoIdStartsWith}]`);
  videoContainers.forEach(container => removeMediaElement(container, stopTracks));
}

function removeLocalMediaElements() {
  const locals = document.getElementById('locals');
  const localMediaContainers = locals.getElementsByTagName('div');
  for (let i = 0; localMediaContainers && i < localMediaContainers.length; i++)
    removeMediaElement(localMediaContainers[i]);
  while (locals.firstChild)
    locals.removeChild(locals.firstChild);
}

function removeRemoteMediaElements() {
  var remotes = document.getElementById('remotes');
  const remoteMediaContainers = remotes.getElementsByTagName('div');
  for (let i = 0; remoteMediaContainers && i < remoteMediaContainers.length; i++)
    removeMediaElement(remoteMediaContainers[i]);
  while (remotes.firstChild)
    remotes.removeChild(remotes.firstChild);
}

function removeAllMediaElements() {
  removeLocalMediaElements();
  removeRemoteMediaElements();
  document.getElementById('videos').getElementsByTagName('span')[0].innerHTML = '   --- VIDEOROOM () ---  ';
}

function closePubPc() {
  if (pubPc) {
    console.log('closing pc for publisher');
    _closePC(pubPc);
    pubPc = null;
  }
}

function closeSubPc() {
  if (subPc) {
    console.log('closing pc for subscriber');
    _closePC(subPc);
    subPc = null;
  }
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
  try {
    pc.close();
  } catch (e) { }
}

function closeAllPCs() {
  console.log('closing all pcs');
  closePubPc();
  closeSubPc();
}
