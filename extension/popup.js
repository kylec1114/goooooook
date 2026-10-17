'use strict';

const el = id => document.getElementById(id);

function note(text) {
  el('status').textContent = text;
}

async function ensureOffscreen() {
  const response = await chrome.runtime.sendMessage({
    target: 'background',
    type: 'ENSURE_OFFSCREEN'
  });

  if (!response?.ok) {
    throw new Error(response?.error || '未能建立音訊處理頁面');
  }
}

el('start').onclick = async () => {
  try {
    note('正在取得目前分頁音訊權限…');

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) throw new Error('找不到目前分頁');

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    if (!streamId) throw new Error('未能取得分頁音訊權限');

    await ensureOffscreen();

    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'START_CENTER_CANCEL',
      streamId,
      strength: Number(el('strength').value)
    });

    note('已啟動。請確保 Chrome 沒有靜音此分頁。');
  } catch (error) {
    note(error?.message || '啟動失敗');
  }
};

el('stop').onclick = async () => {
  try {
    await chrome.runtime.sendMessage({
      target: 'background',
      type: 'STOP_CENTER_CANCEL'
    });
    note('已停止並還原。');
  } catch (error) {
    note(error?.message || '停止失敗');
  }
};

el('strength').oninput = () => {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'SET_STRENGTH',
    strength: Number(el('strength').value)
  }).catch(() => {});
};
