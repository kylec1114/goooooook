'use strict';

const OFFSCREEN_URL = 'offscreen.html';

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: '即時處理 YouTube 分頁音訊，提供實驗性中置人聲減弱。'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'background') return false;

  if (message.type === 'ENSURE_OFFSCREEN') {
    ensureOffscreenDocument()
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === 'STOP_CENTER_CANCEL') {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_CENTER_CANCEL'
    }).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
