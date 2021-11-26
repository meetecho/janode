/* global document, App, RTCPeerConnection, navigator */

'use strict';

const { Janode, EchoTestPlugin } = App;

const Logger = Janode.Logger;
let janodeConnection;

let echoPeerConnection;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const button = document.getElementById('button');
button.onclick = async _ => {
  button.disabled = true;
  if (!janodeConnection) await connect();
  else await janodeConnection.close();
  button.disabled = false;
};

async function connect() {
  try {
    janodeConnection = await Janode.connect({
      address: {
        url: 'ws://127.0.0.1:8188/',
        apisecret: 'secret'
      },
    });
    janodeConnection.on(Janode.EVENT.CONNECTION_CLOSED, _ => janodeConnection = null);
    janodeConnection.on(Janode.EVENT.CONNECTION_ERROR, _ => janodeConnection = null);

    const session = await janodeConnection.create();

    const echoHandle = await session.attach(EchoTestPlugin);
    echoHandle.on(Janode.EVENT.HANDLE_WEBRTCUP, _ => Logger.info('webrtcup event'));
    echoHandle.on(Janode.EVENT.HANDLE_MEDIA, evtdata => Logger.info('media event', evtdata));
    echoHandle.on(Janode.EVENT.HANDLE_HANGUP, evtdata => Logger.info('hangup event', evtdata));
    echoHandle.on(Janode.EVENT.HANDLE_DETACHED, _ => {
      Logger.info('detached event');
      stopAllStreams();
      closePC();
    });

    const offer = await doOffer(echoHandle);
    const { jsep } = await echoHandle.start({
      audio: true,
      video: true,
      bitrate: 512000,
      jsep: offer,
    });
    Logger.info('answer received', jsep);
    await echoPeerConnection.setRemoteDescription(jsep);
    Logger.info('set remote sdp OK');
  } catch (e) {
    Logger.error('error creating echotest', e);
    stopAllStreams();
    closePC();
  }
}

async function trickle(handle, candidate) {
  try {
    if (candidate) await handle.trickle(candidate);
    else await handle.trickleComplete();
  } catch (e) {
    Logger.error('error sending trickle', e);
  }
}

async function doOffer(handle) {
  echoPeerConnection = new RTCPeerConnection({
    'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  echoPeerConnection.onnegotiationneeded = _ => Logger.info('pc.onnegotiationneeded');
  echoPeerConnection.onicecandidate = ({ candidate }) => trickle(handle, candidate);
  echoPeerConnection.oniceconnectionstatechange = _ => { if (['failed', 'disconnected', 'closed'].includes(echoPeerConnection.iceConnectionState)) closePC(); };
  echoPeerConnection.ontrack = event => {
    Logger.info('pc.ontrack', event);
    event.track.onunmute = evt => Logger.info('track.onunmute', evt);
    event.track.onmute = evt => Logger.info('track.onmute', evt);
    event.track.onended = evt => Logger.info('track.onended', evt);
    remoteVideo.srcObject = event.streams[0];
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  Logger.info('getUserMedia OK');

  stream.getTracks().forEach(track => {
    Logger.info('adding track', track);
    echoPeerConnection.addTrack(track, stream);
  });

  localVideo.srcObject = stream;

  const offer = await echoPeerConnection.createOffer();
  Logger.info('create offer OK');
  await echoPeerConnection.setLocalDescription(offer);
  Logger.info('set local sdp OK');
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

function closePC() {
  if (!echoPeerConnection) return;
  echoPeerConnection.getSenders().forEach(sender => { if (sender.track) sender.track.stop(); });
  echoPeerConnection.getReceivers().forEach(receiver => { if (receiver.track) receiver.track.stop(); });
  echoPeerConnection.onnegotiationneeded = null;
  echoPeerConnection.onicecandidate = null;
  echoPeerConnection.oniceconnectionstatechange = null;
  echoPeerConnection.ontrack = null;
  echoPeerConnection.close();
}
