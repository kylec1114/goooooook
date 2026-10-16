CREATE TABLE IF NOT EXISTS rooms (
  room_code TEXT PRIMARY KEY,
  room_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  category TEXT DEFAULT '',
  language TEXT DEFAULT '',
  youtube_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  video_id TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  title TEXT NOT NULL,
  singer TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
