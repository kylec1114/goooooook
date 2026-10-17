CREATE TABLE IF NOT EXISTS room_runtime (
 room_code TEXT PRIMARY KEY, last_active INTEGER NOT NULL,
 guest_hash TEXT,guest_salt TEXT,
 player_hash TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 queue_revision INTEGER NOT NULL DEFAULT 0,
 paused INTEGER NOT NULL DEFAULT 0,volume INTEGER NOT NULL DEFAULT 100,
 restart_revision INTEGER NOT NULL DEFAULT 0,restart_item TEXT
);
INSERT OR IGNORE INTO room_runtime(room_code,last_active) SELECT room_code,CAST(strftime('%s','now') AS INTEGER)*1000 FROM rooms;
CREATE TABLE IF NOT EXISTS queue_ownership(item_id TEXT PRIMARY KEY,room_code TEXT NOT NULL,token_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS player_links(child_hash TEXT PRIMARY KEY,parent_hash TEXT NOT NULL,room_code TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS runtime_expiry ON room_runtime(last_active);
CREATE INDEX IF NOT EXISTS sessions_room ON sessions(room_code);
CREATE INDEX IF NOT EXISTS songs_room ON songs(room_code);
CREATE INDEX IF NOT EXISTS queue_room_position ON queue(room_code,position,created_at,id);
CREATE INDEX IF NOT EXISTS ownership_room ON queue_ownership(room_code);
CREATE INDEX IF NOT EXISTS links_room ON player_links(room_code);
CREATE TABLE IF NOT EXISTS ktv_sync (
 room_code TEXT PRIMARY KEY,
 command_revision INTEGER NOT NULL DEFAULT 0,
 applied_revision INTEGER NOT NULL DEFAULT 0,
 player_hash TEXT,
 reported_at INTEGER NOT NULL DEFAULT 0,
 observed_json TEXT
);
CREATE TABLE IF NOT EXISTS ktv_display (
 room_code TEXT PRIMARY KEY REFERENCES rooms(room_code) ON DELETE CASCADE,
 mode TEXT NOT NULL DEFAULT 'info',
 revision INTEGER NOT NULL DEFAULT 0,
 fullscreen_request TEXT NOT NULL DEFAULT 'none',
 observed_json TEXT,
 reported_at INTEGER NOT NULL DEFAULT 0,
 player_hash TEXT
);
