# goooooook

私人、本機、Excel-driven 家庭卡拉OK系統。只使用 YouTube 官方 iframe 嵌入播放，不下載、不抽音訊、不轉檔。

## 安裝

```bash
npm install
npm run hash -- 你的密碼
```

將輸出的 bcrypt hash 貼入 `data/goooooook.xlsx` 的 `Rooms.password_hash`。

## Excel 格式

建立 `data/goooooook.xlsx`，包含三個 sheet：

- `Rooms`: room_code, password_hash, room_name, active
- `Songs`: song_id, title, artist, youtube_url, category, language
- `QueueLog`: timestamp, room_code, singer, title, youtube_url

## 啟動

```bash
npm start
```

- 手機：http://<電腦 LAN IP>:3000
- 電視：http://localhost:3000/tv.html?room=你的房間碼

## 安全與法律

- Excel 與密碼檔不會上傳 GitHub。
- 密碼只存 bcrypt hash。
- 僅限私人、非商業、家庭使用。
- 不下載 YouTube、不抽音訊、不轉檔、不公開播放。
