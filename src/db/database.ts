import * as SQLite from 'expo-sqlite';

export type GameStatus = 'wish' | 'playing' | 'cleared' | 'dropped';

export interface Box {
  id: number;
  name: string;
  icon: string;
  todo_mode: number;
  thought_count: number;
  created_at: string;
}

export interface LifeItem {
  id: number;
  box_id: number | null;
  content: string;
  tags: string[];
  image_uri: string | null;
  weight: number;
  status: 'pending' | 'completed';
  disabled: number;
  completed_at: string | null;
  created_at: string;
}

export interface GameItem {
  id: number;
  name: string;
  platform: string[];
  status: GameStatus;
  rating: number | null;
  comment: string | null;
  tags: string[];
  image_uri: string | null;
  play_time: number;
  sharp_comment: string | null;
  last_played: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameProgress {
  id: number;
  game_id: number;
  name: string;
  note: string | null;
  progress: number;
  completed: number;
  created_at: string;
}

export interface GameRecord {
  id: number;
  game_id: number;
  content: string;
  played_at: string | null;
  duration: number;
  created_at: string;
}

export interface ArchivedItem {
  id: number;
  source_type: 'life' | 'game';
  ref_id: number;
  title: string;
  rating: number | null;
  diary: string | null;
  completed_at: string;
  archived_at: string;
}

export interface GameObjective {
  id: number;
  game_id: number;
  name: string;
  completed: number;
  completed_at: string | null;
  created_at: string;
}

// ---------- OKR ----------

export interface OKRPeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  archived: number;
  created_at: string;
}

export interface OKRObjective {
  id: number;
  period_id: number;
  title: string;
  description: string | null;
  status: string;
  game_id: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  project_type: string | null;
  project_id: number | null;
  created_at: string;
}

export interface OKRKeyResult {
  id: number;
  objective_id: number;
  parent_id: number | null;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  repeat_mode: number;
  sort_order: number;
  elapsed_seconds: number;
  task_type: string; // 'normal' | 'progress'
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  recurrence: string; // 'none'|'daily'|'weekday'|'weekend'|'weekly'|'monthly'|'ebbinghaus'
  recurrence_days: string | null; // e.g. "1,3,5" for specific days
  reminder_time: string | null; // HH:MM or null
  reset_cycle: string; // 'none'|'daily'|'weekly'|'monthly'
  reset_period_key: string | null;
  accumulated_value: number;
  inherit_parent_schedule: number;
  min_daily_amount: number;
  today_date: string | null;
  source_type: 'game' | 'life' | null;
  source_id: number | null;
  created_at: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('oneday.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS boxes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS life_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          box_id INTEGER REFERENCES boxes(id),
          content TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          image_uri TEXT,
          weight INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'pending',
          disabled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS game_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          platform TEXT,
          status TEXT NOT NULL DEFAULT 'wish',
          rating REAL,
          comment TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          image_uri TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS archived_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_type TEXT NOT NULL,
          ref_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          rating REAL,
          diary TEXT,
          completed_at TEXT NOT NULL,
          archived_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS game_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL REFERENCES game_items(id),
          name TEXT NOT NULL,
          note TEXT,
          progress INTEGER NOT NULL DEFAULT 0,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS game_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL REFERENCES game_items(id),
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS game_objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL REFERENCES game_items(id),
          name TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_draw (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER NOT NULL REFERENCES life_items(id),
          drawn_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS okr_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS okr_objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period_id INTEGER NOT NULL REFERENCES okr_periods(id),
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS okr_key_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objective_id INTEGER NOT NULL REFERENCES okr_objectives(id),
          parent_id INTEGER,
          title TEXT NOT NULL,
          target_value REAL NOT NULL DEFAULT 1,
          current_value REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL DEFAULT '',
          repeat_mode INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          source_type TEXT,
          source_id INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS global_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          module TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS habits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT '✅',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS habit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          habit_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS okr_activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objective_id INTEGER NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS time_capsules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT,
          audio_uri TEXT,
          open_date TEXT NOT NULL,
          is_opened INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
      // Migration: add disabled column if not exists (for databases created before V2)
      try {
        await db.execAsync('ALTER TABLE life_items ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add todo_mode column to boxes
      try {
        await db.execAsync('ALTER TABLE boxes ADD COLUMN todo_mode INTEGER NOT NULL DEFAULT 0');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add status column to habits
      try {
        await db.execAsync("ALTER TABLE habits ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
      } catch {
        // Column already exists, ignore
      }
      // Migration: scale game ratings from 0-10 to 0-5
      await db.runAsync(
        'UPDATE game_items SET rating = ROUND(rating / 2.0, 1) WHERE rating IS NOT NULL AND rating > 5'
      );
      // Migration: add completed_at column to life_items
      try {
        await db.execAsync('ALTER TABLE life_items ADD COLUMN completed_at TEXT');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add icon column to boxes
      try {
        await db.execAsync("ALTER TABLE boxes ADD COLUMN icon TEXT NOT NULL DEFAULT '📦'");
      } catch {
        // Column already exists, ignore
      }
      // Migration: add tags column to game_items
      try {
        await db.execAsync("ALTER TABLE game_items ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
      } catch {
        // Column already exists, ignore
      }
      // Migration: create game_objectives table
      try {
        await db.execAsync(`CREATE TABLE IF NOT EXISTS game_objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL REFERENCES game_items(id),
          name TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL
        )`);
      } catch {
        // Table already exists, ignore
      }
      // Migration: create OKR tables
      try {
        await db.execAsync(`CREATE TABLE IF NOT EXISTS okr_periods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`);
        await db.execAsync(`CREATE TABLE IF NOT EXISTS okr_objectives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period_id INTEGER NOT NULL REFERENCES okr_periods(id),
          title TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL
        )`);
        await db.execAsync(`CREATE TABLE IF NOT EXISTS okr_key_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objective_id INTEGER NOT NULL REFERENCES okr_objectives(id),
          title TEXT NOT NULL,
          target_value REAL NOT NULL DEFAULT 1,
          current_value REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL DEFAULT '',
          repeat_mode INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          source_type TEXT,
          source_id INTEGER,
          created_at TEXT NOT NULL
        )`);
      } catch {
        // Tables already exist, ignore
      }
      // Migration: create app_settings table
      try {
        await db.execAsync(`CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`);
      } catch {
        // Table already exists, ignore
      }
      // Migration: create global_tags table
      try {
        await db.execAsync(`CREATE TABLE IF NOT EXISTS global_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          module TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`);
      } catch {
        // Table already exists, ignore
      }
      // Migration: add repeat_mode column to okr_key_results
      try {
        await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN repeat_mode INTEGER NOT NULL DEFAULT 0');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add status column to okr_objectives
      try {
        await db.execAsync("ALTER TABLE okr_objectives ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
      } catch {
        // Column already exists, ignore
      }
      // Migration: add game_id column to okr_objectives
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN game_id INTEGER');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add source_kr_id column to game_progress
      try {
        await db.execAsync('ALTER TABLE game_progress ADD COLUMN source_kr_id INTEGER');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add sort_order column to okr_key_results
      try {
        await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
      } catch {
        // Column already exists, ignore
      }
      // Migration: create okr_activity_log table
      try {
        await db.execAsync(`CREATE TABLE IF NOT EXISTS okr_activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objective_id INTEGER NOT NULL,
          key_result_id INTEGER,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`);
      } catch {
        // Table already exists, ignore
      }
      // Migration: add key_result_id column to okr_activity_log
      try {
        await db.execAsync('ALTER TABLE okr_activity_log ADD COLUMN key_result_id INTEGER');
      } catch {
        // Column already exists, ignore
      }
      // Signed progress amount for repeatable progress check-ins. Legacy logs
      // represent a +1 action and keep that meaning after migration.
      try { await db.execAsync('ALTER TABLE okr_activity_log ADD COLUMN amount REAL NOT NULL DEFAULT 1'); } catch {}
      // Migration: add play_time column to game_items
      try {
        await db.execAsync('ALTER TABLE game_items ADD COLUMN play_time INTEGER NOT NULL DEFAULT 0');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add sharp_comment column to game_items
      try {
        await db.execAsync('ALTER TABLE game_items ADD COLUMN sharp_comment TEXT');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add last_played column to game_items
      try {
        await db.execAsync('ALTER TABLE game_items ADD COLUMN last_played TEXT');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add parent_id column to okr_key_results
      try {
        await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN parent_id INTEGER');
      } catch {
        // Column already exists, ignore
      }
      // Migration: add start_date, end_date, notes, project_type, project_id to okr_objectives
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN start_date TEXT');
      } catch {}
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN end_date TEXT');
      } catch {}
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN notes TEXT');
      } catch {}
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN project_type TEXT');
      } catch {}
      try {
        await db.execAsync('ALTER TABLE okr_objectives ADD COLUMN project_id INTEGER');
      } catch {}
      // Migration: add played_at and duration columns to game_records
      try {
        await db.execAsync('ALTER TABLE game_records ADD COLUMN played_at TEXT');
      } catch {}
      try {
        await db.execAsync('ALTER TABLE game_records ADD COLUMN duration INTEGER NOT NULL DEFAULT 0');
      } catch {}
      // Migration: add elapsed_seconds column to okr_key_results
      try {
        await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN elapsed_seconds INTEGER NOT NULL DEFAULT 0');
      } catch {}
      // Migration: add new task fields to okr_key_results
      try { await db.execAsync("ALTER TABLE okr_key_results ADD COLUMN task_type TEXT NOT NULL DEFAULT 'normal'"); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN notes TEXT'); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN start_date TEXT'); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN end_date TEXT'); } catch {}
      try { await db.execAsync("ALTER TABLE okr_key_results ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'"); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN recurrence_days TEXT'); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN reminder_time TEXT'); } catch {}
      try { await db.execAsync("ALTER TABLE okr_key_results ADD COLUMN reset_cycle TEXT NOT NULL DEFAULT 'none'"); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN reset_period_key TEXT'); } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN accumulated_value REAL NOT NULL DEFAULT 0'); } catch {}
      try {
        await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN inherit_parent_schedule INTEGER NOT NULL DEFAULT 0');
        await db.execAsync("UPDATE okr_key_results SET inherit_parent_schedule = 1 WHERE parent_id IS NOT NULL AND recurrence = 'none'");
      } catch {}
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN min_daily_amount REAL NOT NULL DEFAULT 0'); } catch {}
      // A nullable local calendar date keeps the feature backwards compatible:
      // existing tasks stay unplanned until the user explicitly adds them.
      try { await db.execAsync('ALTER TABLE okr_key_results ADD COLUMN today_date TEXT'); } catch {}
      // Fix any corrupted play_time values (NaN stored as text)
      try { await db.execAsync("UPDATE game_items SET play_time = 0 WHERE typeof(play_time) != 'integer' OR play_time IS NULL OR play_time < 0"); } catch {}
      // Initialize defaults with the database that is already open. Calling
      // getDb() from here would wait on this same initialization promise.
      await initDefaultPlatformsWithDb(db);
      return db;
    })();
  }
  return dbPromise;
}

function now(): string {
  return new Date().toISOString();
}

function insertedId(result: unknown): number {
  const value = result as { lastInsertRowId?: number; insertId?: number } | null;
  return Number(value?.lastInsertRowId ?? value?.insertId ?? 0);
}

// ---------- boxes ----------

export async function listBoxes(): Promise<Box[]> {
  const db = await getDb();
  return db.getAllAsync<Box>(
    `SELECT b.id, b.name, b.icon, b.todo_mode, b.created_at,
            (SELECT COUNT(*) FROM life_items WHERE box_id = b.id AND status = 'pending') AS thought_count
     FROM boxes b ORDER BY b.created_at DESC`
  );
}

export async function addBox(name: string, icon: string = '📦'): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO boxes (name, icon, todo_mode, created_at) VALUES (?, ?, 0, ?)', name, icon, now());
}

export async function toggleBoxTodoMode(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE boxes SET todo_mode = CASE WHEN todo_mode = 0 THEN 1 ELSE 0 END WHERE id = ?', id);
}

export async function getBox(id: number): Promise<Box | null> {
  const db = await getDb();
  return db.getFirstAsync<Box>(
    `SELECT b.id, b.name, b.icon, b.todo_mode, b.created_at,
            (SELECT COUNT(*) FROM life_items WHERE box_id = b.id AND status = 'pending') AS thought_count
     FROM boxes b WHERE b.id = ?`,
    id
  );
}

export async function deleteBox(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM life_items WHERE box_id = ?', id);
    await db.runAsync('DELETE FROM boxes WHERE id = ?', id);
  });
}

export async function updateBox(id: number, name: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE boxes SET name = ?, icon = ? WHERE id = ?', name, icon, id);
}

export async function copyBox(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const box = await db.getFirstAsync<{ name: string; icon: string }>(
      'SELECT name, icon FROM boxes WHERE id = ?', id
    );
    if (!box) return;
    const ts = now();
    const newName = `${box.name} (副本)`;
    const result = await db.runAsync(
      'INSERT INTO boxes (name, icon, todo_mode, created_at) VALUES (?, ?, 0, ?)',
      newName, box.icon, ts
    );
    const newId = insertedId(result);
    if (newId > 0) {
      await db.runAsync(
        `INSERT INTO life_items (box_id, content, tags, image_uri, weight, status, disabled, created_at)
         SELECT ?, content, tags, image_uri, weight, status, disabled, ?
         FROM life_items WHERE box_id = ?`,
        newId, ts, id
      );
    }
  });
}

// ---------- life_items (thoughts inside boxes) ----------

interface LifeRow extends Omit<LifeItem, 'tags'> {
  tags: string;
}

function mapLife(row: LifeRow): LifeItem {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    tags = Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {}
  return { ...row, tags };
}

interface GameRow extends Omit<GameItem, 'tags' | 'platform'> {
  tags: string;
  platform: string;
}

function mapGame(row: GameRow): GameItem {
  let tags: string[] = [];
  let platform: string[] = [];
  try {
    const parsedTags = JSON.parse(row.tags);
    tags = Array.isArray(parsedTags) ? parsedTags.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {}
  try {
    const parsedPlatform = JSON.parse(row.platform);
    platform = Array.isArray(parsedPlatform)
      ? parsedPlatform.filter((item): item is string => typeof item === 'string')
      : row.platform ? [row.platform] : [];
  } catch {
    // Handle legacy single platform value
    if (row.platform) {
      platform = [row.platform];
    }
  }
  return { ...row, tags, platform, play_time: row.play_time ?? 0, sharp_comment: row.sharp_comment ?? null, last_played: row.last_played ?? null };
}

export async function listThoughtsByBox(boxId: number): Promise<LifeItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LifeRow>(
    "SELECT * FROM life_items WHERE box_id = ? AND status = 'pending' ORDER BY created_at DESC",
    boxId
  );
  return rows.map(mapLife);
}

export async function listCompletedByBox(boxId: number): Promise<LifeItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LifeRow>(
    "SELECT * FROM life_items WHERE box_id = ? AND status = 'completed' ORDER BY completed_at DESC",
    boxId
  );
  return rows.map(mapLife);
}

export async function listDrawableThoughtsByBox(boxId: number): Promise<LifeItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LifeRow>(
    "SELECT * FROM life_items WHERE box_id = ? AND status = 'pending' AND disabled = 0 ORDER BY created_at DESC",
    boxId
  );
  return rows.map(mapLife);
}

export async function addThought(
  boxId: number,
  content: string,
  tags: string[],
  imageUri: string | null
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO life_items (box_id, content, tags, image_uri, weight, status, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    boxId,
    content,
    JSON.stringify(tags),
    imageUri,
    'pending',
    now()
  );
}

export async function updateThought(
  id: number,
  content: string,
  tags: string[],
  imageUri: string | null
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'UPDATE life_items SET content = ?, tags = ?, image_uri = ? WHERE id = ?',
    content,
    JSON.stringify(tags),
    imageUri,
    id
  );
}

export async function toggleThoughtDisabled(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE life_items SET disabled = CASE WHEN disabled = 0 THEN 1 ELSE 0 END WHERE id = ?',
    id
  );
}

export async function deleteLifeItem(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM archived_items WHERE source_type = 'life' AND ref_id = ?", id);
    await db.runAsync('DELETE FROM life_items WHERE id = ?', id);
  });
}

export async function completeLifeItem(item: LifeItem): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO archived_items (source_type, ref_id, title, rating, diary, completed_at, archived_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)',
      'life',
      item.id,
      item.content,
      ts,
      ts
    );
    await db.runAsync("UPDATE life_items SET status = 'completed', completed_at = ? WHERE id = ?", ts, item.id);
  });
}

export async function resetLifeItem(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM archived_items WHERE source_type = 'life' AND ref_id = ?", id);
    await db.runAsync("UPDATE life_items SET status = 'pending', completed_at = NULL WHERE id = ?", id);
  });
}

// ---------- daily_draw ----------

export async function saveDailyDraw(itemId: number): Promise<void> {
  const db = await getDb();
  // Clear any existing draw first, then save new one
  await db.runAsync('DELETE FROM daily_draw');
  await db.runAsync('INSERT INTO daily_draw (item_id, drawn_at) VALUES (?, ?)', itemId, now());
}

export async function getDailyDraw(): Promise<LifeItem | null> {
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const row = await db.getFirstAsync<LifeRow>(
    `SELECT life_items.* FROM daily_draw 
     JOIN life_items ON daily_draw.item_id = life_items.id 
     WHERE date(daily_draw.drawn_at) = ?`,
    today
  );
  return row ? mapLife(row) : null;
}

export async function clearDailyDraw(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM daily_draw');
}

// ---------- game_items ----------

export async function listGames(status: GameStatus): Promise<GameItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameRow>(
    'SELECT * FROM game_items WHERE status = ? ORDER BY updated_at DESC',
    status
  );
  return rows.map(mapGame);
}

export async function listAllGames(): Promise<GameItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameRow>(
    'SELECT * FROM game_items ORDER BY updated_at DESC'
  );
  return rows.map(mapGame);
}

export async function listDrawableGames(): Promise<GameItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameRow>(
    "SELECT * FROM game_items WHERE status IN ('wish', 'playing') ORDER BY updated_at DESC"
  );
  return rows.map(mapGame);
}

export async function addGame(
  name: string,
  platform: string[],
  status: GameStatus,
  imageUri: string | null = null,
  rating: number | null = null,
  tags: string[] = [],
  playTime: number = 0,
  sharpComment: string | null = null,
  lastPlayed: string | null = null
): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    'INSERT INTO game_items (name, platform, status, rating, tags, image_uri, play_time, sharp_comment, last_played, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    name, JSON.stringify(platform), status, rating, JSON.stringify(tags), imageUri, playTime, sharpComment, lastPlayed, ts, ts
  );
}

export async function getGame(id: number): Promise<GameItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<GameRow>(
    'SELECT * FROM game_items WHERE id = ?',
    id
  );
  return row ? mapGame(row) : null;
}

export async function updateGame(
  id: number,
  name: string,
  platform: string[],
  status: GameStatus,
  imageUri: string | null,
  rating: number | null,
  tags: string[] = [],
  playTime?: number,
  sharpComment?: string | null,
  lastPlayed?: string | null
): Promise<void> {
  const db = await getDb();
  if (playTime !== undefined || sharpComment !== undefined || lastPlayed !== undefined) {
    const current = await getGame(id);
    const pt = playTime !== undefined ? playTime : current?.play_time ?? 0;
    const sc = sharpComment !== undefined ? sharpComment : current?.sharp_comment ?? null;
    const lp = lastPlayed !== undefined ? lastPlayed : current?.last_played ?? null;
    await db.runAsync(
      'UPDATE game_items SET name = ?, platform = ?, status = ?, image_uri = ?, rating = ?, tags = ?, play_time = ?, sharp_comment = ?, last_played = ?, updated_at = ? WHERE id = ?',
      name, JSON.stringify(platform), status, imageUri, rating, JSON.stringify(tags), pt, sc, lp, now(), id
    );
  } else {
    await db.runAsync(
      'UPDATE game_items SET name = ?, platform = ?, status = ?, image_uri = ?, rating = ?, tags = ?, updated_at = ? WHERE id = ?',
      name, JSON.stringify(platform), status, imageUri, rating, JSON.stringify(tags), now(), id
    );
  }
}

export async function updateLastPlayed(id: number, dateISO: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE game_items SET last_played = ?, updated_at = ? WHERE id = ?',
    dateISO, now(), id
  );
}

export async function updatePlayTime(id: number, addSeconds: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE game_items SET play_time = CAST(COALESCE(play_time, 0) AS INTEGER) + ?, updated_at = ? WHERE id = ?',
    addSeconds, now(), id
  );
}

export async function deleteGame(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM archived_items WHERE source_type = 'game' AND ref_id = ?", id);
    await db.runAsync('DELETE FROM game_objectives WHERE game_id = ?', id);
    await db.runAsync('DELETE FROM game_records WHERE game_id = ?', id);
    await db.runAsync('DELETE FROM game_progress WHERE game_id = ?', id);
    await db.runAsync('DELETE FROM game_items WHERE id = ?', id);
  });
}

// ---------- game_progress ----------

export async function listProgress(gameId: number): Promise<GameProgress[]> {
  const db = await getDb();
  return db.getAllAsync<GameProgress>(
    'SELECT * FROM game_progress WHERE game_id = ? ORDER BY completed ASC, created_at DESC',
    gameId
  );
}

export async function addProgress(
  gameId: number,
  name: string,
  note: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO game_progress (game_id, name, note, progress, completed, created_at) VALUES (?, ?, ?, 0, 0, ?)',
    gameId,
    name,
    note,
    now()
  );
}

export async function updateProgress(
  id: number,
  progress: number
): Promise<void> {
  const db = await getDb();
  const completed = progress >= 100 ? 1 : 0;
  await db.runAsync(
    'UPDATE game_progress SET progress = ?, completed = ? WHERE id = ?',
    progress,
    completed,
    id
  );
}

export async function toggleProgressComplete(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE game_progress SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END, progress = CASE WHEN completed = 0 THEN 100 ELSE 0 END WHERE id = ?',
    id
  );
}

export async function deleteProgress(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM game_progress WHERE id = ?', id);
}

// ---------- game_records ----------

export async function listRecords(gameId: number): Promise<GameRecord[]> {
  const db = await getDb();
  return db.getAllAsync<GameRecord>(
    'SELECT * FROM game_records WHERE game_id = ? ORDER BY COALESCE(played_at, created_at) DESC, id DESC',
    gameId
  );
}

export async function addRecord(gameId: number, content: string, opts?: { playedAt?: string; durationSeconds?: number }): Promise<void> {
  const db = await getDb();
  const playedAt = opts?.playedAt ?? null;
  const durationSeconds = opts?.durationSeconds ?? 0;
  await db.runAsync(
    'INSERT INTO game_records (game_id, content, played_at, duration, created_at) VALUES (?, ?, ?, ?, ?)',
    gameId,
    content,
    playedAt,
    durationSeconds,
    now()
  );
  if (durationSeconds > 0) {
    await db.runAsync('UPDATE game_items SET play_time = CAST(COALESCE(play_time, 0) AS INTEGER) + ?, updated_at = ? WHERE id = ?', durationSeconds, now(), gameId);
    if (playedAt) {
      await db.runAsync('UPDATE game_items SET last_played = ?, updated_at = ? WHERE id = ?', playedAt, now(), gameId);
    }
  }
}

export async function updateRecord(id: number, content: string, opts: { playedAt: string; durationSeconds: number }): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const previous = await db.getFirstAsync<{ game_id: number; duration: number }>(
      'SELECT game_id, COALESCE(duration, 0) AS duration FROM game_records WHERE id = ?', id
    );
    if (!previous) throw new Error('游戏记录不存在');
    const durationSeconds = Math.max(0, Math.round(opts.durationSeconds || 0));
    await db.runAsync(
      'UPDATE game_records SET content = ?, played_at = ?, duration = ? WHERE id = ?',
      content, opts.playedAt, durationSeconds, id
    );
    const delta = durationSeconds - Number(previous.duration || 0);
    if (delta !== 0) {
      await db.runAsync(
        'UPDATE game_items SET play_time = MAX(0, CAST(COALESCE(play_time, 0) AS INTEGER) + ?), updated_at = ? WHERE id = ?',
        delta, now(), previous.game_id
      );
    }
    const latest = await db.getFirstAsync<{ played_at: string | null }>(
      'SELECT played_at FROM game_records WHERE game_id = ? ORDER BY COALESCE(played_at, created_at) DESC, id DESC LIMIT 1',
      previous.game_id
    );
    await db.runAsync('UPDATE game_items SET last_played = ?, updated_at = ? WHERE id = ?', latest?.played_at ?? opts.playedAt, now(), previous.game_id);
  });
}

export async function deleteRecord(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const record = await db.getFirstAsync<{ game_id: number; duration: number }>(
      'SELECT game_id, COALESCE(duration, 0) AS duration FROM game_records WHERE id = ?',
      id
    );
    if (!record) return;
    await db.runAsync('DELETE FROM game_records WHERE id = ?', id);
    if (record.duration > 0) {
      await db.runAsync(
        'UPDATE game_items SET play_time = MAX(0, CAST(COALESCE(play_time, 0) AS INTEGER) - ?), updated_at = ? WHERE id = ?',
        record.duration,
        now(),
        record.game_id
      );
    }
  });
}

// ---------- game_objectives ----------

export async function listObjectives(gameId: number): Promise<GameObjective[]> {
  const db = await getDb();
  return db.getAllAsync<GameObjective>(
    'SELECT * FROM game_objectives WHERE game_id = ? ORDER BY completed ASC, created_at ASC',
    gameId
  );
}

export async function addObjective(gameId: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO game_objectives (game_id, name, completed, completed_at, created_at) VALUES (?, ?, 0, NULL, ?)',
    gameId,
    name,
    now()
  );
}

export async function toggleObjectiveComplete(id: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<GameObjective>(
    'SELECT * FROM game_objectives WHERE id = ?',
    id
  );
  if (!row) return;
  const newCompleted = row.completed === 0 ? 1 : 0;
  const completedAt = newCompleted ? now() : null;
  await db.runAsync(
    'UPDATE game_objectives SET completed = ?, completed_at = ? WHERE id = ?',
    newCompleted,
    completedAt,
    id
  );
  // Auto-add record when completing an objective
  if (newCompleted) {
    await addRecord(row.game_id, `完成目标：${row.name}`);
  }
}

export async function deleteObjective(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM game_objectives WHERE id = ?', id);
}

// ---------- OKR periods ----------

export async function listPeriods(includeArchived: boolean = false): Promise<OKRPeriod[]> {
  const db = await getDb();
  const where = includeArchived ? '' : ' WHERE archived = 0';
  return db.getAllAsync<OKRPeriod>(
    `SELECT * FROM okr_periods${where} ORDER BY start_date DESC`
  );
}

export async function addPeriod(name: string, startDate: string, endDate: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO okr_periods (name, start_date, end_date, archived, created_at) VALUES (?, ?, ?, 0, ?)',
    name, startDate, endDate, now()
  );
}

export async function updatePeriod(id: number, name: string, startDate: string, endDate: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE okr_periods SET name = ?, start_date = ?, end_date = ? WHERE id = ?',
    name, startDate, endDate, id
  );
}

export async function archivePeriod(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE okr_periods SET archived = 1 WHERE id = ?', id);
}

export async function deletePeriod(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const objectives = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM okr_objectives WHERE period_id = ?', id
    );
    for (const obj of objectives) {
      await db.runAsync('DELETE FROM okr_key_results WHERE objective_id = ?', obj.id);
    }
    await db.runAsync('DELETE FROM okr_objectives WHERE period_id = ?', id);
    await db.runAsync('DELETE FROM okr_periods WHERE id = ?', id);
  });
}

// ---------- OKR objectives ----------

export async function listObjectivesByPeriod(periodId: number): Promise<OKRObjective[]> {
  const db = await getDb();
  return db.getAllAsync<OKRObjective>(
    'SELECT * FROM okr_objectives WHERE period_id = ? ORDER BY created_at ASC',
    periodId
  );
}

export interface AddObjectiveOpts {
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  projectType?: string | null;
  projectId?: number | null;
}

async function getOrCreateDefaultPeriod(startDate?: string | null, endDate?: string | null): Promise<number> {
  const db = await getDb();
  if (startDate && endDate) {
    // Create a period with the given dates
    const name = `${startDate} ~ ${endDate}`;
    const result = await db.runAsync(
      'INSERT INTO okr_periods (name, start_date, end_date, archived, created_at) VALUES (?, ?, ?, 0, ?)',
      name, startDate, endDate, now()
    );
    const periodId = insertedId(result);
    if (!periodId) throw new Error('创建目标周期失败');
    return periodId;
  }
  // Find or create a default "长期" period
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM okr_periods WHERE name = '长期' AND archived = 0"
  );
  if (existing) return existing.id;
  const today = now().slice(0, 10);
  const farEnd = '2099-12-31';
  const result = await db.runAsync(
    'INSERT INTO okr_periods (name, start_date, end_date, archived, created_at) VALUES (?, ?, ?, 0, ?)',
    '长期', today, farEnd, now()
  );
  const periodId = insertedId(result);
  if (!periodId) throw new Error('创建目标周期失败');
  return periodId;
}

export async function addOKRObjective(title: string, opts: AddObjectiveOpts = {}): Promise<void> {
  const db = await getDb();
  const periodId = await getOrCreateDefaultPeriod(opts.startDate, opts.endDate);
  const result = await db.runAsync(
    'INSERT INTO okr_objectives (period_id, title, description, status, game_id, start_date, end_date, notes, project_type, project_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    periodId, title, null, 'active', null,
    opts.startDate ?? null, opts.endDate ?? null,
    opts.notes ?? null,
    opts.projectType ?? null, opts.projectId ?? null,
    now()
  );
  const objectiveId = insertedId(result);
  
  // If linked to a todo-mode box, sync pending items as tasks
  if (objectiveId > 0 && opts.projectType === 'box' && opts.projectId) {
    const box = await db.getFirstAsync<{ todo_mode: number }>(
      'SELECT todo_mode FROM boxes WHERE id = ?',
      opts.projectId
    );
    if (box && box.todo_mode === 1) {
      await syncBoxTodosToOKR(objectiveId, opts.projectId);
    }
  }
}

/** Create the built-in eight-week wrist and lower-limb rehabilitation plan. */
export async function createRehabObjectiveTemplate(startDate?: string): Promise<number> {
  const db = await getDb();
  const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 55);
  const sd = formatLocalDate(start);
  const ed = formatLocalDate(end);
  const existingPlans = await db.getAllAsync<{ id: number; task_count: number }>(
    `SELECT o.id, COUNT(kr.id) AS task_count
     FROM okr_objectives o
     LEFT JOIN okr_key_results kr ON kr.objective_id = o.id
     WHERE o.title = '腿＋手腕居家康复（8周）' AND o.status != 'completed'
     GROUP BY o.id`
  );
  // A complete template currently contains well over one hundred task rows.
  // Anything smaller is a partial result left by an interrupted/older build
  // and is safe to rebuild instead of permanently blocking the template.
  if (existingPlans.some((plan) => Number(plan.task_count) >= 100)) {
    throw new Error('已经有一份进行中的康复计划');
  }
  // Remove every incomplete copy left by older builds or interrupted creation.
  for (const plan of existingPlans) {
    await db.runAsync('DELETE FROM okr_key_results WHERE objective_id = ?', plan.id);
    await db.runAsync('DELETE FROM okr_objectives WHERE id = ?', plan.id);
  }

  const periodId = await getOrCreateDefaultPeriod(sd, ed);
  const notes = '每天28–30分钟；周三、周日休息。动作保持无痛或疼痛≤3/10，膝盖对准第二脚趾，手腕避开疼痛角度。若次日加重退回上一阶段；持续8周无改善或伴无力、麻木，请咨询康复治疗师或手外科。';
  const result = await db.runAsync(
    'INSERT INTO okr_objectives (period_id, title, description, status, game_id, start_date, end_date, notes, project_type, project_id, created_at) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?, NULL, NULL, ?)',
    periodId, '腿＋手腕居家康复（8周）', 'active', sd, ed, notes, now()
  );
  const objectiveId = insertedId(result);
  if (!objectiveId) throw new Error('创建康复计划失败');

  const plans = [
    { day: 1, title: '周一｜手A＋腿A', note: '常规30分钟；若今天打羽毛球，可在任务菜单选择“按羽毛球方案完成”。', hand: '手A：肌腱滑动8次；无痛腕屈伸10次；等长腕屈/伸各5秒×5；旋前旋后10次；软球轻握5秒×10。', leg: '腿A：短足2×10（5秒）；蚌式2×12/侧；臀桥2×15（顶峰2秒）；单腿站2×20秒/侧。' },
    { day: 2, title: '周二｜手B＋腿B', note: '常规30分钟；若今天打羽毛球，可在任务菜单选择“按羽毛球方案完成”。', hand: '手B：肌腱滑动8次；无痛腕尺桡偏10次；等长桡偏/尺偏各5秒×5；旋前旋后10次；肩胛后缩5秒×10。', leg: '腿B：靠墙静蹲3×30秒；慢速提踵3×12；弹力带侧向走2×10步/方向；坐姿伸膝3×12/侧。' },
    { day: 4, title: '周四｜手A＋腿C', note: '常规30分钟；若今天打羽毛球，可在任务菜单选择“按羽毛球方案完成”。', hand: '手A：肌腱滑动8次；无痛腕屈伸10次；等长腕屈/伸各5秒×5；旋前旋后10次；软球轻握5秒×10。', leg: '腿C：短足2×10；侧卧髋外展2×12/侧；单腿臀桥2×8/侧；鸟狗2×8/侧；单腿站2×30秒/侧。' },
    { day: 5, title: '周五｜手B＋腿D', note: '常规30分钟；若今天打羽毛球，可在任务菜单选择“按羽毛球方案完成”。', hand: '手B：肌腱滑动8次；无痛腕尺桡偏10次；等长桡偏/尺偏各5秒×5；旋前旋后10次；肩胛后缩5秒×10。', leg: '腿D：分腿蹲2×8/腿；单脚提踵2×8/侧；死虫2×8/侧；弹力带侧向走2×10步/方向；单腿站3×30秒/侧。' },
    { day: 6, title: '周六｜有氧恢复', note: '常规30分钟；若今天打羽毛球，可在任务菜单选择“按羽毛球方案完成”。', hand: '手部：轻柔屈伸拉伸3分钟；避免疼痛角度。', leg: '有氧20分钟（快走/骑车/游泳）；短足2×10；单腿站3×30秒/侧；冷身3分钟。' },
  ];
  const badminton = '羽毛球替代：打球前热身5分钟；手部激活4分钟；腿部激活4分钟；打球后冷身5分钟。减少杀球和反手过度发力，手腕中立位，痛就停。';
  const warmup = '踏步摆臂；踝泵；髋绕环；肩绕环；手腕无痛屈伸';
  const cooldown = '小腿拉伸；髋屈肌拉伸；手腕轻柔屈伸拉伸；足底滚球';
  try {
    for (const plan of plans) {
      const parentId = await addKeyResult(objectiveId, plan.title, 8, '', null, null, 1, null, {
        taskType: 'normal', notes: `${plan.note}\n${badminton}`, startDate: sd, endDate: ed,
        recurrence: 'weekly', recurrenceDays: String(plan.day),
      });
      for (const [title, detail] of [['热身', warmup], ['手部训练', plan.hand], ['腿部训练', plan.leg], ['冷身', cooldown]] as const) {
        const categoryId = await addKeyResult(objectiveId, title, 8, '', null, null, 1, parentId, {
          taskType: 'normal', notes: detail, startDate: sd, endDate: ed,
          recurrence: 'weekly', recurrenceDays: String(plan.day), inheritParentSchedule: true,
        });
        const actions = detail
          .replace(/^(手A|手B|腿A|腿B|腿C|腿D)：/, '')
          .split('；')
          .map((action) => action.trim())
          .filter(Boolean);
        for (const action of actions) {
          const actionTitle = action.includes('：') ? action.slice(0, action.indexOf('：')) : action;
          await addKeyResult(objectiveId, actionTitle, 8, '', null, null, 1, categoryId, {
            taskType: 'normal', notes: action, startDate: sd, endDate: ed,
            recurrence: 'weekly', recurrenceDays: String(plan.day), inheritParentSchedule: true,
          });
        }
      }
    }
  } catch (error) {
    // Never leave a broken plan visible when one of its many task inserts fails.
    await db.runAsync('DELETE FROM okr_key_results WHERE objective_id = ?', objectiveId);
    await db.runAsync('DELETE FROM okr_objectives WHERE id = ?', objectiveId);
    throw error;
  }
  return objectiveId;
}

export async function updateObjective(
  id: number,
  title: string,
  opts?: {
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    projectType?: string | null;
    projectId?: number | null;
  }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE okr_objectives SET title = ?, start_date = ?, end_date = ?, notes = ?, project_type = ?, project_id = ? WHERE id = ?',
    title,
    opts?.startDate ?? null,
    opts?.endDate ?? null,
    opts?.notes ?? null,
    opts?.projectType ?? null,
    opts?.projectId ?? null,
    id
  );
}

export async function updateObjectiveStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE okr_objectives SET status = ? WHERE id = ?', status, id);
}

export async function getObjective(id: number): Promise<OKRObjective | null> {
  const db = await getDb();
  return db.getFirstAsync<OKRObjective>('SELECT * FROM okr_objectives WHERE id = ?', id);
}

export async function deleteObjectiveOKR(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM okr_key_results WHERE objective_id = ?', id);
    await db.runAsync('DELETE FROM okr_objectives WHERE id = ?', id);
  });
}

// ---------- OKR key results ----------

export async function listKeyResults(objectiveId: number): Promise<OKRKeyResult[]> {
  const db = await getDb();
  await applyScheduledResets(objectiveId);
  await applyInheritedSchedules(objectiveId);
  await normalizeRecurringTargets(objectiveId);
  return db.getAllAsync<OKRKeyResult>(
    'SELECT * FROM okr_key_results WHERE objective_id = ? AND parent_id IS NULL ORDER BY sort_order ASC, created_at ASC',
    objectiveId
  );
}

export async function listAllKeyResults(objectiveId: number): Promise<OKRKeyResult[]> {
  const db = await getDb();
  await applyScheduledResets(objectiveId);
  await applyInheritedSchedules(objectiveId);
  await normalizeRecurringTargets(objectiveId);
  return db.getAllAsync<OKRKeyResult>(
    'SELECT * FROM okr_key_results WHERE objective_id = ? ORDER BY sort_order ASC, created_at ASC',
    objectiveId
  );
}

export async function listSubKeyResults(parentId: number): Promise<OKRKeyResult[]> {
  const db = await getDb();
  const parent = await db.getFirstAsync<{ objective_id: number }>('SELECT objective_id FROM okr_key_results WHERE id = ?', parentId);
  if (parent) await applyScheduledResets(parent.objective_id);
  return db.getAllAsync<OKRKeyResult>(
    'SELECT * FROM okr_key_results WHERE parent_id = ? ORDER BY sort_order ASC, created_at ASC',
    parentId
  );
}

export async function addKeyResult(
  objectiveId: number,
  title: string,
  targetValue: number,
  unit: string = '',
  sourceType: 'game' | 'life' | null = null,
  sourceId: number | null = null,
  repeatMode: number = 0,
  parentId: number | null = null,
  opts?: {
    taskType?: string;
    notes?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    recurrence?: string;
    recurrenceDays?: string | null;
    reminderTime?: string | null;
    resetCycle?: string;
    minDailyAmount?: number;
    initialValue?: number;
    inheritParentSchedule?: boolean;
  }
): Promise<number> {
  const db = await getDb();
  if (parentId) {
    const parentDepth = await db.getFirstAsync<{ depth: number }>(
      `WITH RECURSIVE ancestors(id, parent_id, depth) AS (
         SELECT id, parent_id, 1 FROM okr_key_results WHERE id = ?
         UNION ALL
         SELECT parent.id, parent.parent_id, child.depth + 1
         FROM okr_key_results parent
         JOIN ancestors child ON parent.id = child.parent_id
       )
       SELECT MAX(depth) AS depth FROM ancestors`,
      parentId
    );
    if ((parentDepth?.depth ?? 0) >= 3) {
      throw new Error('任务最多支持 3 级');
    }
  }
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM okr_key_results WHERE objective_id = ?', objectiveId
  );
  const sortOrder = row?.cnt ?? 0;
  const taskType = opts?.taskType ?? 'normal';
  const notes = opts?.notes ?? null;
  const startDate = opts?.startDate ?? null;
  const endDate = opts?.endDate ?? null;
  const recurrence = opts?.recurrence ?? 'none';
  const recurrenceDays = opts?.recurrenceDays ?? null;
  const reminderTime = opts?.reminderTime ?? null;
  const resetCycle = opts?.resetCycle ?? 'none';
  const minDailyAmount = opts?.minDailyAmount ?? 0;
  const initialValue = Math.max(0, Math.min(targetValue, opts?.initialValue ?? 0));
  const resetPeriodKey = resetCycle === 'none' ? null : getResetPeriodKey(resetCycle, new Date());
  const inheritParentSchedule = parentId && opts?.inheritParentSchedule ? 1 : 0;
  const result = await db.runAsync(
    `INSERT INTO okr_key_results (objective_id, parent_id, title, target_value, current_value, unit, repeat_mode, sort_order, source_type, source_id, task_type, notes, start_date, end_date, recurrence, recurrence_days, reminder_time, reset_cycle, reset_period_key, min_daily_amount, inherit_parent_schedule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    objectiveId, parentId, title, targetValue, initialValue, unit, repeatMode, sortOrder, sourceType, sourceId,
    taskType, notes, startDate, endDate, recurrence, recurrenceDays, reminderTime, resetCycle, resetPeriodKey, minDailyAmount, inheritParentSchedule, now()
  );
  const krId = insertedId(result);
  if (!krId) throw new Error('创建任务失败');
  // Sync to game if objective is linked to a game
  if (!parentId && krId > 0) {
    await syncOKRKeyResultToGame(krId, objectiveId, title, targetValue, unit, repeatMode);
  }
  return krId;
}

// Sync box todo items to OKR tasks when objective is linked to a todo-mode box
export async function syncBoxTodosToOKR(objectiveId: number, boxId: number): Promise<void> {
  const db = await getDb();
  // Get all pending life_items from the box
  const items = await db.getAllAsync<{ id: number; content: string }>(
    'SELECT id, content FROM life_items WHERE box_id = ? AND status = "pending"',
    boxId
  );
  
  // Create OKR tasks for each pending item
  for (const item of items) {
    await addKeyResult(
      objectiveId,
      item.content,
      1,
      '',
      'life', // source type
      item.id, // source id (life_item id)
      0 // not repeat
    );
  }
}

// Update life_item status when OKR task is completed
export async function syncOKRTaskToLifeItem(krId: number): Promise<void> {
  const db = await getDb();
  const kr = await db.getFirstAsync<{ source_type: string; source_id: number; current_value: number; target_value: number }>(
    'SELECT source_type, source_id, current_value, target_value FROM okr_key_results WHERE id = ?',
    krId
  );
  
  if (kr && kr.source_type === 'life' && kr.source_id) {
    const isDone = kr.current_value >= kr.target_value;
    await db.runAsync(
      'UPDATE life_items SET status = ?, completed_at = ? WHERE id = ?',
      isDone ? 'completed' : 'pending',
      isDone ? now() : null,
      kr.source_id
    );
  }
}

export async function updateKRSortOrder(id: number, sortOrder: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE okr_key_results SET sort_order = ? WHERE id = ?', sortOrder, id);
}

export async function toggleKRToday(id: number, date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE okr_key_results SET today_date = CASE WHEN today_date = ? THEN NULL ELSE ? END WHERE id = ?',
    date, date, id
  );
}

export interface TodayTask extends OKRKeyResult {
  objective_title: string;
}

export async function listTodayTasks(date: string): Promise<TodayTask[]> {
  const db = await getDb();
  return db.getAllAsync<TodayTask>(
    `SELECT kr.*, o.title AS objective_title
     FROM okr_key_results kr
     JOIN okr_objectives o ON o.id = kr.objective_id
     WHERE kr.today_date = ? AND o.status = 'active' AND kr.current_value < kr.target_value
     ORDER BY kr.sort_order ASC, kr.created_at ASC`,
    date
  );
}

export async function getKeyResult(id: number): Promise<OKRKeyResult | null> {
  const db = await getDb();
  return await db.getFirstAsync<OKRKeyResult>('SELECT * FROM okr_key_results WHERE id = ?', id);
}

export async function updateKeyResult(
  id: number,
  title: string,
  targetValue: number,
  unit: string,
  sourceType: 'game' | 'life' | null,
  sourceId: number | null,
  repeatMode: number = 0,
  opts?: {
    taskType?: string;
    notes?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    recurrence?: string;
    recurrenceDays?: string | null;
    reminderTime?: string | null;
    resetCycle?: string;
    minDailyAmount?: number;
    inheritParentSchedule?: boolean;
  }
): Promise<void> {
  const db = await getDb();
  const previous = await db.getFirstAsync<{ reset_cycle: string; reset_period_key: string | null }>('SELECT reset_cycle, reset_period_key FROM okr_key_results WHERE id = ?', id);
  const nextResetCycle = opts?.resetCycle ?? 'none';
  const resetPeriodKey = nextResetCycle === 'none' ? null : getResetPeriodKey(nextResetCycle, new Date());
  const result = await db.runAsync(
    `UPDATE okr_key_results SET title = ?, target_value = ?, unit = ?, repeat_mode = ?,
     source_type = ?, source_id = ?, task_type = ?, notes = ?, start_date = ?,
     end_date = ?, recurrence = ?, recurrence_days = ?, reminder_time = ?,
     reset_cycle = ?, reset_period_key = ?, min_daily_amount = ?, inherit_parent_schedule = ?
     WHERE id = ?`,
    title, targetValue, unit, repeatMode,
    sourceType, sourceId,
    opts?.taskType ?? 'normal', opts?.notes ?? null, opts?.startDate ?? null,
    opts?.endDate ?? null, opts?.recurrence ?? 'none', opts?.recurrenceDays ?? null,
    opts?.reminderTime ?? null, nextResetCycle,
    previous?.reset_cycle === nextResetCycle ? previous?.reset_period_key ?? resetPeriodKey : resetPeriodKey,
    opts?.minDailyAmount ?? 0, opts?.inheritParentSchedule ? 1 : 0,
    id
  );
  if ((result as any).changes === 0) throw new Error('没有找到要编辑的任务');
  await cascadeInheritedSchedule(id);
}

async function cascadeInheritedSchedule(parentId: number): Promise<void> {
  const db = await getDb();
  const parent = await db.getFirstAsync<OKRKeyResult>('SELECT * FROM okr_key_results WHERE id = ?', parentId);
  if (!parent) return;
  const children = await db.getAllAsync<OKRKeyResult>(
    'SELECT * FROM okr_key_results WHERE parent_id = ? AND inherit_parent_schedule = 1', parentId
  );
  for (const child of children) {
    const inherited = { ...child, start_date: parent.start_date, end_date: parent.end_date, recurrence: parent.recurrence, recurrence_days: parent.recurrence_days };
    const target = parent.recurrence === 'none' ? 1 : calcNormalTaskQuantity(inherited);
    await db.runAsync(
      `UPDATE okr_key_results SET start_date = ?, end_date = ?, recurrence = ?, recurrence_days = ?,
       repeat_mode = ?, target_value = ?, current_value = MIN(current_value, ?) WHERE id = ?`,
      parent.start_date, parent.end_date, parent.recurrence, parent.recurrence_days,
      parent.recurrence === 'none' ? 0 : 1, target, target, child.id
    );
    await cascadeInheritedSchedule(child.id);
  }
}

async function applyInheritedSchedules(objectiveId: number): Promise<void> {
  const db = await getDb();
  const roots = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM okr_key_results WHERE objective_id = ? AND parent_id IS NULL', objectiveId
  );
  for (const root of roots) await cascadeInheritedSchedule(root.id);
}

async function normalizeRecurringTargets(objectiveId: number): Promise<void> {
  const db = await getDb();
  const tasks = await db.getAllAsync<OKRKeyResult>(
    "SELECT * FROM okr_key_results WHERE objective_id = ? AND task_type = 'normal' AND recurrence != 'none'",
    objectiveId
  );
  for (const task of tasks) {
    const target = calcNormalTaskQuantity(task);
    if (Number(task.target_value) !== target) {
      await db.runAsync(
        'UPDATE okr_key_results SET target_value = ?, current_value = MIN(current_value, ?) WHERE id = ?',
        target, target, task.id
      );
    }
  }
}

export async function updateKRProgress(id: number, currentValue: number): Promise<void> {
  const db = await getDb();
  await applyScheduledResetForTask(id);
  const safeValue = Number.isFinite(currentValue) ? currentValue : 0;
  await db.runAsync(
    'UPDATE okr_key_results SET current_value = MIN(MAX(0, ?), MAX(0, target_value)) WHERE id = ?',
    safeValue,
    id
  );
  // Log activity
  const kr = await db.getFirstAsync<{ objective_id: number }>(
    'SELECT objective_id FROM okr_key_results WHERE id = ?', id
  );
  if (kr) {
    const today = new Date().toISOString().slice(0, 10);
    await db.runAsync(
      'INSERT INTO okr_activity_log (objective_id, key_result_id, date, created_at) VALUES (?, ?, ?, ?)',
      kr.objective_id, id, today, now()
    );
  }
  // Sync to life_item if this task came from a box todo
  await syncOKRTaskToLifeItem(id);
}

export async function toggleKRRepeat(id: number, repeatMode: number): Promise<void> {
  const db = await getDb();
  if (repeatMode === 0) {
    // Switching to non-repeat: reset current_value to 0, target to 1
    await db.runAsync('UPDATE okr_key_results SET repeat_mode = 0, current_value = 0, target_value = 1 WHERE id = ?', id);
  } else {
    // Switching to repeat: reset current_value to 0
    await db.runAsync('UPDATE okr_key_results SET repeat_mode = 1, current_value = 0 WHERE id = ?', id);
  }
}

export async function incrementKR(id: number): Promise<void> {
  const db = await getDb();
  await applyScheduledResetForTask(id);
  const task = await db.getFirstAsync<OKRKeyResult>('SELECT * FROM okr_key_results WHERE id = ?', id);
  if (!task) throw new Error('任务不存在');
  const today = formatLocalDate(new Date());
  if (task.task_type !== 'progress' && task.recurrence && task.recurrence !== 'none') {
    const dueCount = countScheduledOccurrencesThroughDate(task, new Date());
    if (Number(task.current_value) >= dueCount) throw new Error('当前没有待完成的循环次数');
  }
  await db.runAsync(
    'UPDATE okr_key_results SET current_value = MIN(current_value + 1, MAX(0, target_value)) WHERE id = ?',
    id
  );
  // Log activity
  const kr = await db.getFirstAsync<{ objective_id: number }>(
    'SELECT objective_id FROM okr_key_results WHERE id = ?', id
  );
  if (kr) {
    await db.runAsync(
      'INSERT INTO okr_activity_log (objective_id, key_result_id, date, created_at) VALUES (?, ?, ?, ?)',
      kr.objective_id, id, today, now()
    );
  }
  // Sync to life_item if this task came from a box todo
  await syncOKRTaskToLifeItem(id);
}

/** Complete one due occurrence for every leaf below a recurring parent task. */
export async function completeRecurringTaskTree(id: number): Promise<void> {
  const db = await getDb();
  const descendants = await db.getAllAsync<OKRKeyResult>(
    `WITH RECURSIVE tree(id) AS (
       SELECT id FROM okr_key_results WHERE parent_id = ?
       UNION ALL
       SELECT child.id FROM okr_key_results child JOIN tree parent ON child.parent_id = parent.id
     )
     SELECT task.* FROM tree
     JOIN okr_key_results task ON task.id = tree.id
     LEFT JOIN okr_key_results child ON child.parent_id = tree.id
     WHERE child.id IS NULL`, id
  );
  if (descendants.length === 0) {
    await incrementKR(id);
    return;
  }
  let completedCount = 0;
  const today = new Date();
  for (const task of descendants) {
    const dueCount = countScheduledOccurrencesThroughDate(task, today);
    if (Number(task.current_value) < dueCount) {
      await incrementKR(task.id);
      completedCount++;
    }
  }
  if (completedCount === 0) throw new Error('当前没有待完成的训练任务');
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isScheduledOccurrence(task: OKRKeyResult, date: Date): boolean {
  const dateText = formatLocalDate(date);
  if ((task.start_date && dateText < task.start_date) || (task.end_date && dateText > task.end_date)) return false;
  const weekday = date.getDay() || 7;
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekday') return weekday <= 5;
  if (task.recurrence === 'weekend') return weekday >= 6;
  if (task.recurrence === 'weekly') return new Set((task.recurrence_days || '').split(',').map(Number)).has(weekday);
  if (task.recurrence === 'monthly') return new Set((task.recurrence_days || '').split(',').map(Number)).has(date.getDate());
  if (task.recurrence === 'ebbinghaus' && task.start_date) {
    const start = new Date(`${task.start_date}T00:00:00`);
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = Math.round((current.getTime() - start.getTime()) / 86400000);
    return [0, 1, 3, 6, 14, 29].includes(offset);
  }
  return false;
}

function countScheduledOccurrencesThroughDate(task: OKRKeyResult, date: Date): number {
  if (!task.start_date) return 0;
  const start = new Date(`${task.start_date}T00:00:00`);
  const requestedEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const configuredEnd = task.end_date ? new Date(`${task.end_date}T00:00:00`) : requestedEnd;
  const end = requestedEnd < configuredEnd ? requestedEnd : configuredEnd;
  if (end < start) return 0;
  let count = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    if (isScheduledOccurrence(task, cursor)) count++;
  }
  return count;
}

function localDateParts(date: Date): { year: number; month: number; day: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

function getResetPeriodKey(cycle: string, date: Date): string {
  const { year, month, day } = localDateParts(date);
  if (cycle === 'daily') return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (cycle === 'monthly') return `${year}-${String(month).padStart(2, '0')}`;
  if (cycle === 'weekly') {
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - weekday);
    const first = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - first.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return 'none';
}

async function applyScheduledResetForTask(id: number, date = new Date()): Promise<void> {
  const db = await getDb();
  const kr = await db.getFirstAsync<{ reset_cycle: string; reset_period_key: string | null }>(
    'SELECT reset_cycle, reset_period_key FROM okr_key_results WHERE id = ?', id
  );
  if (!kr || !kr.reset_cycle || kr.reset_cycle === 'none') return;
  const currentKey = getResetPeriodKey(kr.reset_cycle, date);
  if (kr.reset_period_key !== currentKey) {
    await db.runAsync('UPDATE okr_key_results SET accumulated_value = accumulated_value + current_value, current_value = 0, reset_period_key = ? WHERE id = ?', currentKey, id);
  }
}

async function applyScheduledResets(objectiveId: number, date = new Date()): Promise<void> {
  const db = await getDb();
  const tasks = await db.getAllAsync<{ id: number; reset_cycle: string; reset_period_key: string | null }>(
    "SELECT id, reset_cycle, reset_period_key FROM okr_key_results WHERE objective_id = ? AND task_type = 'progress' AND reset_cycle != 'none'",
    objectiveId
  );
  for (const task of tasks) {
    const currentKey = getResetPeriodKey(task.reset_cycle, date);
    if (task.reset_period_key !== currentKey) {
      await db.runAsync('UPDATE okr_key_results SET accumulated_value = accumulated_value + current_value, current_value = 0, reset_period_key = ? WHERE id = ?', currentKey, task.id);
    }
  }
}

export async function addKRProgressRecord(id: number, date: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('进度值不能为 0');
  const db = await getDb();
  await applyScheduledResetForTask(id);
  await db.withTransactionAsync(async () => {
    const kr = await db.getFirstAsync<{ objective_id: number; current_value: number; target_value: number; reset_cycle: string; reset_period_key: string | null; accumulated_value: number }>(
      'SELECT objective_id, current_value, target_value, reset_cycle, reset_period_key, accumulated_value FROM okr_key_results WHERE id = ?', id
    );
    if (!kr) throw new Error('任务不存在');
    const recordPeriodKey = kr.reset_cycle && kr.reset_cycle !== 'none'
      ? getResetPeriodKey(kr.reset_cycle, new Date(`${date}T12:00:00`))
      : kr.reset_period_key;
    if (kr.reset_cycle !== 'none' && recordPeriodKey !== kr.reset_period_key) {
      const nextAccumulated = Math.max(0, Number(kr.accumulated_value || 0) + amount);
      const appliedAmount = nextAccumulated - Number(kr.accumulated_value || 0);
      if (appliedAmount === 0) throw new Error('历史累计进度已经是 0');
      await db.runAsync('UPDATE okr_key_results SET accumulated_value = ? WHERE id = ?', nextAccumulated, id);
      await db.runAsync(
        'INSERT INTO okr_activity_log (objective_id, key_result_id, date, amount, created_at) VALUES (?, ?, ?, ?, ?)',
        kr.objective_id, id, date, appliedAmount, now()
      );
      return;
    }
    const nextValue = Math.max(0, Math.min(Number(kr.target_value), Number(kr.current_value) + amount));
    const appliedAmount = nextValue - Number(kr.current_value);
    if (appliedAmount === 0) throw new Error(amount > 0 ? '当前进度已达到目标' : '当前进度已经是 0');
    await db.runAsync('UPDATE okr_key_results SET current_value = ? WHERE id = ?', nextValue, id);
    await db.runAsync(
      'INSERT INTO okr_activity_log (objective_id, key_result_id, date, amount, created_at) VALUES (?, ?, ?, ?, ?)',
      kr.objective_id, id, date, appliedAmount, now()
    );
  });
  await syncOKRTaskToLifeItem(id);
}

export async function updateKRTarget(id: number, targetValue: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE okr_key_results SET target_value = ? WHERE id = ?', targetValue, id);
}

export async function addKRElapsed(id: number, seconds: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE okr_key_results SET elapsed_seconds = COALESCE(elapsed_seconds, 0) + ? WHERE id = ?', seconds, id);
}

export async function deleteKeyResult(id: number): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    // Remove synced entry from game_progress
    await removeSyncedKRFromGame(id);
    // Remove the complete task subtree, including third-level descendants.
    await db.runAsync(
      `WITH RECURSIVE descendants(id) AS (
         SELECT id FROM okr_key_results WHERE id = ?
         UNION ALL
         SELECT child.id FROM okr_key_results child
         JOIN descendants parent ON child.parent_id = parent.id
       )
       DELETE FROM okr_key_results WHERE id IN (SELECT id FROM descendants)`,
      id
    );
  });
}

// Permanently complete a task (set to target, disable repeat)
export async function completeKRPermanently(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE okr_key_results SET current_value = target_value, repeat_mode = 0 WHERE id = ?',
    id
  );
}

// Postpone a task by one day (shift start_date and end_date forward)
export async function postponeKR(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE okr_key_results 
     SET start_date = CASE WHEN start_date IS NOT NULL THEN date(start_date, '+1 day') ELSE NULL END,
         end_date = CASE WHEN end_date IS NOT NULL THEN date(end_date, '+1 day') ELSE NULL END
     WHERE id = ?`,
    id
  );
}

export async function getOKRActivityDates(objectiveId: number, month: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM okr_activity_log WHERE objective_id = ? AND date LIKE ? ORDER BY date ASC',
    objectiveId, `${month}%`
  );
  return rows.map((r) => r.date);
}

export async function getAllOKRActivityDates(month: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM okr_activity_log WHERE date LIKE ? ORDER BY date ASC',
    `${month}%`
  );
  return rows.map((r) => r.date);
}

export interface DayActivity {
  key_result_id: number;
  title: string;
  repeat_mode: number;
  target_value: number;
  current_value: number;
  unit: string;
  activity_count: number;
  activity_amount: number;
}

export async function getOKRDayActivities(objectiveId: number, date: string): Promise<DayActivity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DayActivity>(
    `SELECT kr.id AS key_result_id, kr.title, kr.repeat_mode, kr.target_value, kr.current_value, kr.unit,
            COUNT(al.id) AS activity_count, COALESCE(SUM(al.amount), COUNT(al.id)) AS activity_amount
     FROM okr_key_results kr
     LEFT JOIN okr_activity_log al ON al.key_result_id = kr.id AND al.date = ?
     WHERE kr.objective_id = ? AND al.id IS NOT NULL
     GROUP BY kr.id
     ORDER BY kr.sort_order ASC`,
    date, objectiveId
  );
  return rows;
}

export interface GlobalDayActivity {
  objective_id: number;
  objective_title: string;
  key_result_id: number;
  title: string;
  task_type: string;
  repeat_mode: number;
  target_value: number;
  current_value: number;
  unit: string;
  activity_count: number;
  activity_amount: number;
}

export async function getAllOKRDayActivities(date: string): Promise<GlobalDayActivity[]> {
  const db = await getDb();
  return db.getAllAsync<GlobalDayActivity>(
    `SELECT o.id AS objective_id, o.title AS objective_title,
            kr.id AS key_result_id, kr.title, kr.task_type, kr.repeat_mode, kr.target_value, kr.current_value, kr.unit,
            COUNT(al.id) AS activity_count, COALESCE(SUM(al.amount), COUNT(al.id)) AS activity_amount
     FROM okr_activity_log al
     JOIN okr_key_results kr ON al.key_result_id = kr.id
     JOIN okr_objectives o ON kr.objective_id = o.id
     WHERE al.date = ?
     GROUP BY o.id, kr.id
     ORDER BY o.created_at ASC, kr.sort_order ASC`,
    date
  );
}

export async function deleteOKRActivityLog(keyResultId: number, date: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const task = await db.getFirstAsync<{ task_type: string; current_value: number; target_value: number }>(
      'SELECT task_type, current_value, target_value FROM okr_key_results WHERE id = ?', keyResultId
    );
    if (task?.task_type === 'progress') {
      const row = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), COUNT(*)) AS total FROM okr_activity_log WHERE key_result_id = ? AND date = ?',
        keyResultId, date
      );
      const restored = Math.max(0, Math.min(Number(task.target_value), Number(task.current_value) - Number(row?.total ?? 0)));
      await db.runAsync('UPDATE okr_key_results SET current_value = ? WHERE id = ?', restored, keyResultId);
    }
    await db.runAsync('DELETE FROM okr_activity_log WHERE key_result_id = ? AND date = ?', keyResultId, date);
  });
  await syncOKRTaskToLifeItem(keyResultId);
}

export async function getOKRActivityCounts(objectiveId: number, startDate: string, endDate: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; cnt: number }>(
    `SELECT date, COUNT(*) as cnt FROM okr_activity_log
     WHERE objective_id = ? AND date >= ? AND date <= ?
     GROUP BY date ORDER BY date ASC`,
    objectiveId, startDate, endDate
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.date] = r.cnt;
  return map;
}

export async function getObjectivesWithProgress(periodId: number): Promise<(OKRObjective & { progress: number; kr_count: number; kr_done: number; period_end_date: string })[]> {
  const db = await getDb();
  const objectives = await listObjectivesByPeriod(periodId);
  const period = await db.getFirstAsync<{ end_date: string }>(
    'SELECT end_date FROM okr_periods WHERE id = ?', periodId
  );
  const periodEndDate = period?.end_date ?? '';
  const result: (OKRObjective & { progress: number; kr_count: number; kr_done: number; period_end_date: string })[] = [];
  for (const obj of objectives) {
    const krs = await listAllKeyResults(obj.id);
    const rootKrs = krs.filter((kr) => kr.parent_id === null);
    const krCount = krs.length;
    let totalWeight = 0;
    let totalDone = 0;
    let krDone = 0;
    for (const kr of rootKrs) {
      const quantity = calcTaskQuantity(kr, krs);
      const done = calcTaskDone(kr, krs);
      totalWeight += quantity;
      totalDone += Math.min(done, quantity);
    }
    for (const kr of krs) {
      const quantity = calcTaskQuantity(kr, krs);
      const done = calcTaskDone(kr, krs);
      if (quantity > 0 && done >= quantity) krDone++;
    }
    const progress = totalWeight > 0 ? Math.round((totalDone / totalWeight) * 100) : 0;
    result.push({ ...obj, progress, kr_count: krCount, kr_done: krDone, period_end_date: periodEndDate });
  }
  return result;
}

// ---------- Task quantity calculation utilities ----------

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function countWeekdays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day >= 1 && day <= 5) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

function countWeekends(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day === 0 || day === 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

function countSpecificWeekdays(start: string, end: string, daysStr: string): number {
  const targetDays = new Set(daysStr.split(',').map(Number));
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay() || 7; // Convert Sunday from 0 to 7
    if (targetDays.has(day)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

function countSpecificMonthDays(start: string, end: string, daysStr: string): number {
  const targetDays = new Set(daysStr.split(',').map(Number));
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (targetDays.has(cur.getDate())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

/** Calculate the quantity (total occurrences) of a normal task based on recurrence */
export function calcNormalTaskQuantity(kr: OKRKeyResult): number {
  const recurrence = kr.recurrence || 'none';
  const startDate = kr.start_date;
  const endDate = kr.end_date;

  if (recurrence === 'none' || !startDate || !endDate) return 1;
  if (recurrence === 'daily') return daysBetween(startDate, endDate);
  if (recurrence === 'weekday') return countWeekdays(startDate, endDate);
  if (recurrence === 'weekend') return countWeekends(startDate, endDate);
  if (recurrence === 'weekly' && kr.recurrence_days) return countSpecificWeekdays(startDate, endDate, kr.recurrence_days);
  if (recurrence === 'monthly' && kr.recurrence_days) return countSpecificMonthDays(startDate, endDate, kr.recurrence_days);
  if (recurrence === 'ebbinghaus') {
    const availableDays = daysBetween(startDate, endDate);
    return [1, 2, 4, 7, 15, 30].filter((day) => day <= availableDays).length || 1;
  }
  return 1;
}

/** Calculate the multiplier for a progress task based on reset cycle */
export function calcProgressMultiplier(kr: OKRKeyResult): number {
  const resetCycle = kr.reset_cycle || 'none';
  const startDate = kr.start_date;
  const endDate = kr.end_date;

  if (resetCycle === 'none' || !startDate || !endDate) return 1;
  if (resetCycle === 'daily') return daysBetween(startDate, endDate);
  if (resetCycle === 'weekly') {
    const days = daysBetween(startDate, endDate);
    return Math.max(1, Math.ceil(days / 7));
  }
  if (resetCycle === 'monthly') {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return Math.max(1, months);
  }
  return 1;
}

/** Calculate the total quantity for a task (considers subtasks, recurrence, reset cycle) */
export function calcTaskQuantity(kr: OKRKeyResult, allKrs: OKRKeyResult[]): number {
  // If this task has subtasks, quantity = sum of subtask quantities
  const subtasks = allKrs.filter((k) => k.parent_id === kr.id);
  if (subtasks.length > 0) {
    return subtasks.reduce((sum, sub) => sum + calcTaskQuantity(sub, allKrs), 0);
  }

  const taskType = kr.task_type || 'normal';
  if (taskType === 'progress') {
    const multiplier = calcProgressMultiplier(kr);
    return (kr.target_value || 1) * multiplier;
  }
  // Normal task
  return calcNormalTaskQuantity(kr);
}

/** Calculate the done quantity for a task */
export function calcTaskDone(kr: OKRKeyResult, allKrs: OKRKeyResult[]): number {
  const subtasks = allKrs.filter((k) => k.parent_id === kr.id);
  if (subtasks.length > 0) {
    return subtasks.reduce((sum, sub) => sum + calcTaskDone(sub, allKrs), 0);
  }
  if (kr.task_type === 'progress' && kr.reset_cycle && kr.reset_cycle !== 'none') {
    return (kr.accumulated_value || 0) + (kr.current_value || 0);
  }
  return kr.current_value || 0;
}

// ---------- objectives with progress ----------

export async function getAllObjectivesWithProgress(): Promise<(OKRObjective & { progress: number; kr_count: number; kr_done: number; period_end_date: string; period_name: string })[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OKRObjective & { period_end_date: string; period_name: string }>(
    `SELECT o.*,
            COALESCE(o.end_date, p.end_date, '') AS period_end_date,
            CASE WHEN o.start_date IS NOT NULL AND o.end_date IS NOT NULL
                 THEN o.start_date || ' ~ ' || o.end_date
                 ELSE '长期目标' END AS period_name
     FROM okr_objectives o
     LEFT JOIN okr_periods p ON o.period_id = p.id
     ORDER BY o.created_at DESC`
  );
  const result: (OKRObjective & { progress: number; kr_count: number; kr_done: number; period_end_date: string; period_name: string })[] = [];
  for (const obj of rows) {
    const krs = await listAllKeyResults(obj.id);
    const rootKrs = krs.filter((kr) => kr.parent_id === null);
    const krCount = krs.length;

    let totalQuantity = 0;
    let totalDone = 0;
    let krDone = 0;

    for (const kr of rootKrs) {
      const quantity = calcTaskQuantity(kr, krs);
      const done = calcTaskDone(kr, krs);
      totalQuantity += quantity;
      totalDone += Math.min(done, quantity);
    }
    for (const kr of krs) {
      const quantity = calcTaskQuantity(kr, krs);
      const done = calcTaskDone(kr, krs);
      if (done >= quantity && quantity > 0) krDone++;
    }

    const progress = totalQuantity > 0 ? Math.round((totalDone / totalQuantity) * 100) : 0;
    let status = obj.status;
    if (status === 'active' && krCount > 0 && progress >= 100) {
      await db.runAsync("UPDATE okr_objectives SET status = 'completed' WHERE id = ?", obj.id);
      status = 'completed';
    }
    result.push({ ...obj, status, progress, kr_count: krCount, kr_done: krDone });
  }
  return result;
}

export async function syncKRWithSource(kr: OKRKeyResult): Promise<void> {
  const db = await getDb();
  if (kr.source_type === 'game') {
    if (kr.source_id) {
      // Linked to specific game: use its rating
      const game = await db.getFirstAsync<{ rating: number | null }>(
        'SELECT rating FROM game_items WHERE id = ?', kr.source_id
      );
      if (game && game.rating != null) {
        await db.runAsync('UPDATE okr_key_results SET current_value = ? WHERE id = ?', game.rating, kr.id);
      }
    } else {
      // No specific game: count cleared games
      const row = await db.getFirstAsync<{ cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM game_items WHERE status = 'cleared'"
      );
      if (row) {
        await db.runAsync('UPDATE okr_key_results SET current_value = ? WHERE id = ?', row.cnt, kr.id);
      }
    }
  } else if (kr.source_type === 'life' && kr.source_id) {
    // Linked to a box: count completed items
    const row = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM life_items WHERE box_id = ? AND status = 'completed'",
      kr.source_id
    );
    if (row) {
      await db.runAsync('UPDATE okr_key_results SET current_value = ? WHERE id = ?', row.cnt, kr.id);
    }
  }
}

export async function syncAllKRForObjective(objectiveId: number): Promise<void> {
  const krs = await listKeyResults(objectiveId);
  for (const kr of krs) {
    if (kr.source_type) {
      await syncKRWithSource(kr);
    }
  }
}

// Sync OKR key result to game_progress
async function syncOKRKeyResultToGame(
  krId: number,
  objectiveId: number,
  title: string,
  targetValue: number,
  unit: string,
  repeatMode: number
): Promise<void> {
  const db = await getDb();
  const obj = await db.getFirstAsync<{ game_id: number | null }>(
    'SELECT game_id FROM okr_objectives WHERE id = ?', objectiveId
  );
  if (!obj?.game_id) return;
  const gameId = obj.game_id;
  // Check if already synced
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM game_progress WHERE source_kr_id = ?', krId
  );
  if (existing) {
    // Update existing entry
    await db.runAsync(
      'UPDATE game_progress SET name = ?, note = ? WHERE id = ?',
      title,
      repeatMode === 1 ? `重复任务，目标 ${targetValue}${unit ? ' ' + unit : ''}` : null,
      existing.id
    );
  } else {
    // Create new entry
    await db.runAsync(
      'INSERT INTO game_progress (game_id, name, note, progress, completed, source_kr_id, created_at) VALUES (?, ?, ?, 0, 0, ?, ?)',
      gameId,
      title,
      repeatMode === 1 ? `重复任务，目标 ${targetValue}${unit ? ' ' + unit : ''}` : null,
      krId,
      now()
    );
  }
}

async function removeSyncedKRFromGame(krId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM game_progress WHERE source_kr_id = ?', krId);
}

// ---------- archived_items / memoir ----------

export async function deleteArchivedItem(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM archived_items WHERE id = ?', id);
}

export async function unclearGame(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE game_items SET status = 'playing', updated_at = ? WHERE id = ?", now(), id);
}

export interface MemoirEntry {
  key: string;
  source_type: 'life' | 'game' | 'game_record';
  title: string;
  rating: number | null;
  note: string | null;
  date: string;
}

// game_records.played_at has existed in two formats:
// legacy "YYYY-MM-DD" and current "YYYY-MM-DD HH:mm". Convert both to a
// parseable local timestamp for memoir display without rewriting user data.
function normalizePlayedAt(playedAt: string | null, fallback: string): string {
  if (!playedAt) return fallback;
  const value = playedAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) return value.replace(' ', 'T');
  return value;
}

export async function listMemoir(): Promise<MemoirEntry[]> {
  const db = await getDb();
  const archived = await db.getAllAsync<ArchivedItem>(
    'SELECT * FROM archived_items'
  );
  const clearedGames = await db.getAllAsync<GameItem>(
    "SELECT * FROM game_items WHERE status = 'cleared'"
  );
  const gameRecords = await db.getAllAsync<GameRecord & { game_name: string }>(
    'SELECT gr.*, g.name AS game_name FROM game_records gr JOIN game_items g ON g.id = gr.game_id'
  );
  const entries: MemoirEntry[] = [
    ...archived.map((a) => ({
      key: `life-${a.id}`,
      source_type: 'life' as const,
      title: a.title,
      rating: a.rating,
      note: a.diary,
      date: a.completed_at,
    })),
    ...clearedGames.map((g) => ({
      key: `game-${g.id}`,
      source_type: 'game' as const,
      title: g.name,
      rating: g.rating,
      note: g.comment,
      date: g.updated_at,
    })),
    ...gameRecords.map((r) => ({ key: `record-${r.id}`, source_type: 'game_record' as const, title: r.game_name, rating: null, note: r.content, date: normalizePlayedAt(r.played_at, r.created_at) })),
  ];
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}

// ---------- global_tags ----------

export interface GlobalTag {
  id: number;
  name: string;
  module: string;
  created_at: string;
}

export async function listGlobalTags(module?: string): Promise<GlobalTag[]> {
  const db = await getDb();
  if (module) {
    return db.getAllAsync<GlobalTag>(
      'SELECT * FROM global_tags WHERE module = ? ORDER BY created_at ASC',
      module
    );
  }
  return db.getAllAsync<GlobalTag>('SELECT * FROM global_tags ORDER BY module ASC, created_at ASC');
}

export async function addGlobalTag(name: string, module: string): Promise<void> {
  const db = await getDb();
  // Check for duplicate
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM global_tags WHERE name = ? AND module = ?',
    name, module
  );
  if (existing) return;
  await db.runAsync(
    'INSERT INTO global_tags (name, module, created_at) VALUES (?, ?, ?)',
    name, module, now()
  );
}

export async function deleteGlobalTag(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM global_tags WHERE id = ?', id);
}

export async function getTagsForModule(module: string): Promise<string[]> {
  const tags = await listGlobalTags(module);
  return tags.map((t) => t.name);
}

const DEFAULT_GAME_PLATFORMS = ['Switch', 'PS5', 'Xbox', 'PC', '手游', '其他'];

async function initDefaultPlatformsWithDb(db: SQLite.SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM global_tags WHERE module = 'game_platform'"
  );
  if ((existing?.count ?? 0) > 0) return;

  const createdAt = now();
  await db.withTransactionAsync(async () => {
    for (const platform of DEFAULT_GAME_PLATFORMS) {
      await db.runAsync(
        'INSERT INTO global_tags (name, module, created_at) VALUES (?, ?, ?)',
        platform,
        'game_platform',
        createdAt
      );
    }
  });
}

export async function initDefaultPlatforms(): Promise<void> {
  const db = await getDb();
  await initDefaultPlatformsWithDb(db);
}

// ---------- app_settings ----------

const DEFAULT_ACTIVE_MODULES = ['inspiration', 'game', 'dice', 'okr'];
const VALID_MODULES = new Set(['inspiration', 'game', 'dice', 'okr', 'habit', 'timeCapsule']);

export async function getActiveModules(): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'active_modules'"
  );
  if (!row) return [...DEFAULT_ACTIVE_MODULES];
  try {
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [...DEFAULT_ACTIVE_MODULES];
    const modules = [...new Set(parsed.filter((id): id is string => typeof id === 'string' && VALID_MODULES.has(id)))];
    return modules.length > 0 ? modules : [...DEFAULT_ACTIVE_MODULES];
  } catch {
    return [...DEFAULT_ACTIVE_MODULES];
  }
}

export async function setActiveModules(modules: string[]): Promise<void> {
  const db = await getDb();
  const safeModules = [...new Set(modules.filter((id) => VALID_MODULES.has(id)))];
  if (safeModules.length === 0) throw new Error('至少需要保留一个应用');
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('active_modules', ?)",
    JSON.stringify(safeModules)
  );
}

export async function getHomeMessageBoxId(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'home_message_box_id'"
  );
  if (!row) return null;
  const id = Number(row.value);
  if (!Number.isInteger(id) || id <= 0) return null;
  const exists = await db.getFirstAsync<{ id: number }>('SELECT id FROM boxes WHERE id = ?', id);
  return exists ? id : null;
}

export async function setHomeMessageBoxId(boxId: number | null): Promise<void> {
  const db = await getDb();
  if (boxId === null) {
    await db.runAsync("DELETE FROM app_settings WHERE key = 'home_message_box_id'");
    return;
  }
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('home_message_box_id', ?)",
    String(boxId)
  );
}

export async function getRandomHomeMessage(): Promise<{ content: string; box_name: string } | null> {
  const db = await getDb();
  return db.getFirstAsync<{ content: string; box_name: string }>(
    `SELECT li.content, b.name AS box_name
     FROM app_settings s
     JOIN boxes b ON b.id = CAST(s.value AS INTEGER)
     JOIN life_items li ON li.box_id = b.id
     WHERE s.key = 'home_message_box_id'
       AND li.status = 'pending' AND li.disabled = 0
       AND TRIM(li.content) <> ''
     ORDER BY RANDOM() LIMIT 1`
  );
}

export async function listMemoirDates(source?: 'game' | 'box'): Promise<string[]> {
  const db = await getDb();
  const archived = await db.getAllAsync<{ completed_at: string }>(
    'SELECT completed_at FROM archived_items'
  );
  const clearedGames = await db.getAllAsync<{ updated_at: string }>(
    "SELECT updated_at FROM game_items WHERE status = 'cleared'"
  );
  const gameRecords = await db.getAllAsync<{ played_at: string | null; created_at: string }>('SELECT played_at, created_at FROM game_records');
  const dates = new Set<string>();
  if (source !== 'game') archived.forEach((a) => dates.add(a.completed_at.split('T')[0]));
  if (source !== 'box') {
    clearedGames.forEach((g) => dates.add(g.updated_at.split('T')[0]));
    gameRecords.forEach((r) => dates.add((r.played_at || r.created_at).slice(0, 10)));
  }
  return Array.from(dates).sort();
}

export async function listMemoirByDate(dateStr: string): Promise<MemoirEntry[]> {
  const db = await getDb();
  const archived = await db.getAllAsync<ArchivedItem>(
    'SELECT * FROM archived_items WHERE date(completed_at) = ?',
    dateStr
  );
  const clearedGames = await db.getAllAsync<GameItem>(
    "SELECT * FROM game_items WHERE status = 'cleared' AND date(updated_at) = ?",
    dateStr
  );
  const gameRecords = await db.getAllAsync<GameRecord & { game_name: string }>(
    `SELECT gr.*, g.name AS game_name FROM game_records gr JOIN game_items g ON g.id = gr.game_id
     WHERE date(COALESCE(gr.played_at, gr.created_at)) = ?`, dateStr
  );
  const entries: MemoirEntry[] = [
    ...archived.map((a) => ({
      key: `life-${a.id}`,
      source_type: 'life' as const,
      title: a.title,
      rating: a.rating,
      note: a.diary,
      date: a.completed_at,
    })),
    ...clearedGames.map((g) => ({
      key: `game-${g.id}`,
      source_type: 'game' as const,
      title: g.name,
      rating: g.rating,
      note: g.comment,
      date: g.updated_at,
    })),
    ...gameRecords.map((r) => ({ key: `record-${r.id}`, source_type: 'game_record' as const, title: r.game_name, rating: null, note: r.content, date: normalizePlayedAt(r.played_at, r.created_at) })),
  ];
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}

// ---------- habits ----------

export interface Habit {
  id: number;
  name: string;
  icon: string;
  status: string; // 'active' | 'paused' | 'completed'
  created_at: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  date: string;
  created_at: string;
}

export async function listHabits(): Promise<Habit[]> {
  const db = await getDb();
  return db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY created_at ASC');
}

export async function addHabit(name: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO habits (name, icon, created_at) VALUES (?, ?, ?)',
    name, icon, new Date().toISOString()
  );
}

export async function deleteHabit(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', id);
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
}

export async function deleteHabitLog(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM habit_logs WHERE id = ?', id);
}

export async function checkInHabit(habitId: number, date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO habit_logs (habit_id, date, created_at) VALUES (?, ?, ?)',
    habitId, date, new Date().toISOString()
  );
}

export async function getHabitLogsByDate(date: string): Promise<HabitLog[]> {
  const db = await getDb();
  return db.getAllAsync<HabitLog>(
    'SELECT * FROM habit_logs WHERE date = ? ORDER BY created_at DESC',
    date
  );
}

export async function getHabitLogsWithHabit(date: string): Promise<(HabitLog & { habit_name: string; habit_icon: string })[]> {
  const db = await getDb();
  return db.getAllAsync<HabitLog & { habit_name: string; habit_icon: string }>(
    `SELECT hl.*, h.name AS habit_name, h.icon AS habit_icon
     FROM habit_logs hl
     JOIN habits h ON hl.habit_id = h.id
     WHERE hl.date = ?
     ORDER BY hl.created_at DESC`,
    date
  );
}

export async function getHabitLogDates(month: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM habit_logs WHERE date LIKE ? ORDER BY date ASC',
    `${month}%`
  );
  return rows.map((r) => r.date);
}

export async function getHabitCheckInCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.getAllAsync<{ habit_id: number; cnt: number }>(
    'SELECT habit_id, COUNT(*) as cnt FROM habit_logs WHERE date = ? GROUP BY habit_id',
    today
  );
  const result: Record<number, number> = {};
  for (const r of rows) {
    result[r.habit_id] = r.cnt;
  }
  return result;
}

export async function undoHabitCheckIn(habitId: number, date: string): Promise<void> {
  const db = await getDb();
  const latest = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM habit_logs WHERE habit_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1',
    habitId, date
  );
  if (latest) await db.runAsync('DELETE FROM habit_logs WHERE id = ?', latest.id);
}

export async function getHabitHistory(startDate: string, endDate: string): Promise<Record<number, string[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ habit_id: number; date: string }>(
    'SELECT DISTINCT habit_id, date FROM habit_logs WHERE date >= ? AND date <= ? ORDER BY date ASC',
    startDate, endDate
  );
  const result: Record<number, string[]> = {};
  for (const row of rows) (result[row.habit_id] ??= []).push(row.date);
  return result;
}

export interface TodayOverview {
  activeHabitCount: number;
  checkedHabitCount: number;
  availableCapsuleCount: number;
  recentGame: Pick<GameItem, 'id' | 'name' | 'image_uri' | 'last_played'> | null;
  dailyDraw: LifeItem | null;
}

export async function getTodayOverview(date: string): Promise<TodayOverview> {
  const db = await getDb();
  const habit = await db.getFirstAsync<{ active_count: number; checked_count: number }>(
    `SELECT
       (SELECT COUNT(*) FROM habits WHERE status = 'active') AS active_count,
       (SELECT COUNT(DISTINCT habit_id) FROM habit_logs WHERE date = ?) AS checked_count`,
    date
  );
  const capsule = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM time_capsules WHERE is_opened = 0 AND open_date <= ?', date
  );
  const recentGame = await db.getFirstAsync<Pick<GameItem, 'id' | 'name' | 'image_uri' | 'last_played'>>(
    "SELECT id, name, image_uri, last_played FROM game_items WHERE status = 'playing' ORDER BY COALESCE(last_played, updated_at) DESC LIMIT 1"
  );
  return {
    activeHabitCount: habit?.active_count ?? 0,
    checkedHabitCount: habit?.checked_count ?? 0,
    availableCapsuleCount: capsule?.count ?? 0,
    recentGame: recentGame ?? null,
    dailyDraw: await getDailyDraw(),
  };
}

// Update habit status
export async function updateHabitStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE habits SET status = ? WHERE id = ?', status, id);
}

// Get total check-in days for a habit
export async function getHabitTotalDays(habitId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(DISTINCT date) as cnt FROM habit_logs WHERE habit_id = ?',
    habitId
  );
  return row?.cnt || 0;
}

// Get consecutive check-in days (streak) for a habit
export async function getHabitStreak(habitId: number): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC',
    habitId
  );
  
  if (rows.length === 0) return 0;
  
  let streak = 1;
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = rows[0].date;
  
  // If last check-in is not today or yesterday, streak is broken
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  
  if (lastDate !== today && lastDate !== yesterdayStr) {
    return 0;
  }
  
  // Count consecutive days
  for (let i = 1; i < rows.length; i++) {
    const currentDate = new Date(rows[i - 1].date + 'T00:00:00');
    const prevDate = new Date(rows[i].date + 'T00:00:00');
    const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// ---------- Time Capsules ----------

export interface TimeCapsule {
  id: number;
  title: string;
  content: string | null;
  audio_uri: string | null;
  open_date: string;
  is_opened: number;
  created_at: string;
}

export async function listTimeCapsules(): Promise<TimeCapsule[]> {
  const db = await getDb();
  return db.getAllAsync<TimeCapsule>(
    'SELECT * FROM time_capsules ORDER BY open_date ASC, created_at DESC'
  );
}

export async function addTimeCapsule(
  title: string,
  content: string | null,
  audioUri: string | null,
  openDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO time_capsules (title, content, audio_uri, open_date, is_opened, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    title, content, audioUri, openDate, now()
  );
}

export async function updateTimeCapsule(
  id: number,
  title: string,
  content: string | null,
  audioUri: string | null,
  openDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE time_capsules SET title = ?, content = ?, audio_uri = ?, open_date = ? WHERE id = ?',
    title, content, audioUri, openDate, id
  );
}

export async function deleteTimeCapsule(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM time_capsules WHERE id = ?', id);
}

export async function getTimeCapsule(id: number): Promise<TimeCapsule | null> {
  const db = await getDb();
  return db.getFirstAsync<TimeCapsule>('SELECT * FROM time_capsules WHERE id = ?', id);
}

export async function openTimeCapsule(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE time_capsules SET is_opened = 1 WHERE id = ?', id);
}

// ---------- Data Backup & Restore ----------

const BACKUP_TABLES = [
  'boxes', 'life_items', 'game_items', 'game_progress', 'game_records',
  'game_objectives', 'archived_items', 'daily_draw', 'okr_periods',
  'okr_objectives', 'okr_key_results', 'okr_activity_log', 'habits',
  'habit_logs', 'app_settings', 'global_tags', 'time_capsules'
] as const;

const MAX_BACKUP_JSON_LENGTH = 25 * 1024 * 1024;

export async function exportDatabase(): Promise<string> {
  const db = await getDb();
  
  // Export all tables to JSON
  const data: Record<string, any[]> = {};
  
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        data[table] = rows;
      }
    } catch (err) {
      console.warn(`Failed to export table ${table}:`, err);
    }
  }
  
  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonData: string): Promise<void> {
  if (!jsonData || jsonData.length > MAX_BACKUP_JSON_LENGTH) {
    throw new Error('备份文件为空或超过 25MB 限制');
  }

  const db = await getDb();
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error('备份文件不是有效的 JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('备份文件结构不正确');
  }

  const data = parsed as Record<string, unknown>;
  const unknownTables = Object.keys(data).filter(
    (table) => !BACKUP_TABLES.includes(table as (typeof BACKUP_TABLES)[number])
  );
  if (unknownTables.length > 0) {
    throw new Error(`备份文件包含不支持的数据表：${unknownTables.join('、')}`);
  }

  const allowedColumns = new Map<string, Set<string>>();
  for (const table of BACKUP_TABLES) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}")`);
    allowedColumns.set(table, new Set(columns.map((column) => column.name)));
    const rows = data[table];
    if (rows !== undefined && !Array.isArray(rows)) {
      throw new Error(`${table} 表的数据格式不正确`);
    }
  }

  await db.withTransactionAsync(async () => {
    // Child tables must be cleared before their parent tables.
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM "${table}"`);
    }

    for (const table of BACKUP_TABLES) {
      const rows = (data[table] ?? []) as unknown[];
      const schemaColumns = allowedColumns.get(table)!;
      for (const rawRow of rows) {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
          throw new Error(`${table} 表包含无效记录`);
        }
        const row = rawRow as Record<string, unknown>;
        const columns = Object.keys(row);
        if (columns.length === 0 || columns.some((column) => !schemaColumns.has(column))) {
          throw new Error(`${table} 表包含不支持的字段`);
        }
        const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`,
          ...columns.map((column) => row[column] as any)
        );
      }
    }
  });
}
