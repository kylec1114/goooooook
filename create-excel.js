const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const lyricsDir = path.join(dataDir, 'lyrics');
const excelPath = path.join(dataDir, 'goooooook.xlsx');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(lyricsDir)) fs.mkdirSync(lyricsDir, { recursive: true });

if (fs.existsSync(excelPath)) {
  console.log('Excel 已存在：' + excelPath);
  process.exit(0);
}

const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ['room_code', 'password_hash', 'room_name', 'active']
]), 'Rooms');

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ['song_id', 'title', 'artist', 'youtube_url', 'category', 'language', 'lrc_file']
]), 'Songs');

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ['timestamp', 'room_code', 'singer', 'title', 'youtube_url']
]), 'QueueLog');

XLSX.writeFile(wb, excelPath);

console.log('已建立：' + excelPath);
console.log('已建立歌詞資料夾：' + lyricsDir);
console.log('下一步：npm run hash -- 你的密碼，然後用「建立新房間」功能或手動加入 Rooms。');
