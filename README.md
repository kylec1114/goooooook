# goooooook

私人、本機、Excel-driven 家庭卡拉OK系統。只使用 YouTube 官方 iframe 嵌入播放，不下載、不抽音訊、不轉檔。

## 重要架構

Excel、歌詞、密碼資料**只存在於 host 機**（即執行 `npm start` 嗰部電腦／NAS）。手機同電視只透過 LAN 連入 server，不會下載或取得 Excel 檔。

## 安裝與設定

```bash
npm install
npm run setup
npm run hash -- 你的密碼
npm start
```

`npm run setup` 會建立：

- `data/goooooook.xlsx`
- `data/lyrics/`

## Excel 格式

### Rooms

| room_code | password_hash | room_name | active |
|---|---|---|---|
| 自動產生 | bcrypt hash | 屋企 KTV | TRUE |

### Songs

| song_id | title | artist | youtube_url | category | language | lrc_file |
|---|---|---|---|---|---|---|

`lrc_file` 填相對檔名，例如 `gurenge.lrc`，檔案放在 `data/lyrics/`。

### QueueLog

| timestamp | room_code | singer | title | youtube_url |
|---|---|---|---|---|

## 使用

- 手機：`http://<host 機 LAN IP>:3000`
- 電視：`http://localhost:3000/tv.html?room=你的房間碼`
- 建立新房間：手機頁按「建立新房間」，系統會自動產生 7 位房間碼。

## LRC 字幕

將 `.lrc` 放入 `data/lyrics/`，並喺 Songs 的 `lrc_file` 填檔名。電視播放時會根據 YouTube 時間同步顯示。

## 安全與法律

- Excel 與密碼檔不會上傳 GitHub。
- 密碼只存 bcrypt hash。
- 僅限私人、非商業、家庭使用。
- 不下載 YouTube、不抽音訊、不轉檔、不公開播放。
