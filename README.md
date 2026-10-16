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

## 使用

- 手機：`http://<host 機 LAN IP>:3000`
- 電視：`http://localhost:3000/tv.html?room=你的房間碼&token=你的Token`
- 建立新房間：手機頁按「建立新房間」，系統會自動產生 7 位房間碼。

## 桌面版

```bash
npm run electron
```

會開一個 Electron 視窗，連去 `http://localhost:3000`。

## 打包下載檔

```bash
npm run dist
```

會產生：

- Windows：`dist/goooooook Setup.exe`
- macOS：`dist/goooooook.dmg`
- Linux：`dist/goooooook.AppImage`

將產物上傳到 GitHub Releases，下載頁就會自動指向最新 Release。

## Android APK

```bash
npm run android:add
npm run android:open
```

喺 Android Studio build APK，或：

```bash
npm run android:build
```

APK 會喺：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 下載頁

`download/index.html` 已預設指向 GitHub Releases 最新版本：

- Windows `.exe`
- macOS `.dmg`
- Android `.apk`

## 安全與法律

- Excel 與密碼檔不會上傳 GitHub。
- 密碼只存 bcrypt hash。
- 僅限私人、非商業、家庭使用。
- 不下載 YouTube、不抽音訊、不轉檔、不公開播放。
