'use strict';

let audioContext = null;
let sourceNode = null;
let splitterNode = null;
let invertNode = null;
let centerNode = null;
let mergerNode = null;
let destinationNode = null;
let outputAudio = null;
let currentStream = null;
let strength = 0.85;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  if (message.type === 'START_CENTER_CANCEL') {
    startCenterCancel(message.streamId, message.strength)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'STOP_CENTER_CANCEL') {
    stopCenterCancel();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'SET_STRENGTH') {
    strength = Math.min(1, Math.max(0, Number(message.strength ?? 85) / 100));
    updateMix();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function startCenterCancel(streamId, initialStrength) {
  stopCenterCancel();
  strength = Math.min(1, Math.max(0, Number(initialStrength ?? 85) / 100));

  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  audioContext = new AudioContext();
  await audioContext.resume();

  sourceNode = audioContext.createMediaStreamSource(currentStream);
  splitterNode = audioContext.createChannelSplitter(2);

  invertNode = audioContext.createGain();
  invertNode.gain.value = -1;

  centerNode = audioContext.createGain();
  centerNode.gain.value = 1 - strength;

  mergerNode = audioContext.createChannelMerger(2);
  destinationNode = audioContext.createMediaStreamDestination();

  sourceNode.connect(splitterNode);
  splitterNode.connect(mergerNode, 0, 0);
  splitterNode.connect(invertNode, 1);
  invertNode.connect(centerNode);
  centerNode.connect(mergerNode, 0, 0);
  mergerNode.connect(destinationNode);

  outputAudio = new Audio();
  outputAudio.srcObject = destinationNode.stream;
  outputAudio.volume = 1;
  await outputAudio.play();
}

function updateMix() {
  if (centerNode) centerNode.gain.value = 1 - strength;
}

function stopCenterCancel() {
  try {
    outputAudio?.pause();
    outputAudio?.srcObject?.getTracks()?.forEach(track => track.stop());
    sourceNode?.disconnect();
    splitterNode?.disconnect();
    invertNode?.disconnect();
    centerNode?.disconnect();
    mergerNode?.disconnect();
    destinationNode?.disconnect();
    audioContext?.close();
  } catch (error) {
    console.warn('Cleanup warning:', error);
  }

  outputAudio = null;
  currentStream = null;
  sourceNode = null;
  splitterNode = null;
  invertNode = null;
  centerNode = null;
  mergerNode = null;
  destinationNode = null;
  audioContext = null;
}
