import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { getDb } from '../db/database';

let timerInterval: ReturnType<typeof setInterval> | null = null;
let timerStartTime: number | null = null;
let timerGameId: number | null = null;
let notificationId: string | null = null;
let responseListener: Notifications.EventSubscription | null = null;
let onStopCallback: ((elapsedSeconds: number, startTime: string, endTime: string) => void) | null = null;

// Format seconds to HH:MM:SS
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Format time range HH:MM:SS~HH:MM:SS
export function formatTimeRange(startISO: string, endISO: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  return `${fmt(startISO)}~${fmt(endISO)}`;
}

async function updateNotification(gameName: string, elapsed: number) {
  if (notificationId) {
    await Notifications.dismissNotificationAsync(notificationId);
  }
  notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎮 ${gameName}`,
      body: `游戏中 ${formatElapsed(elapsed)} · 点击停止`,
      sticky: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
  });
}

export async function startTimer(
  gameId: number,
  gameName: string,
  onStop?: (elapsedSeconds: number, startTime: string, endTime: string) => void
) {
  // Stop existing timer if any
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (notificationId) {
    await Notifications.dismissNotificationAsync(notificationId);
    notificationId = null;
  }

  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Notification permission denied');
  }

  // Set up Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('game-timer', {
      name: '游戏计时',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6FA58A',
      showBadge: false,
      enableVibrate: false,
    });
  }

  // Set up stop action handler
  if (responseListener) {
    responseListener.remove();
  }
  responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.actionIdentifier === 'stop') {
      handleStopFromNotification();
    }
  });

  // Save timer state to DB
  const db = await getDb();
  const startTime = new Date().toISOString();
  await db.runAsync(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('game_timer', ?)",
    JSON.stringify({ gameId, startTime })
  );

  timerStartTime = Date.now();
  timerGameId = gameId;
  onStopCallback = onStop ?? null;

  // Show initial notification
  await updateNotification(gameName, 0);

  // Update notification every 5 seconds
  timerInterval = setInterval(async () => {
    if (timerStartTime) {
      const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
      await updateNotification(gameName, elapsed);
    }
  }, 5000);
}

async function handleStopFromNotification() {
  if (timerInterval && timerStartTime && timerGameId !== null) {
    clearInterval(timerInterval);
    timerInterval = null;

    const endTime = new Date().toISOString();
    const startTimeISO = new Date(timerStartTime).toISOString();
    const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);

    // Clear notification
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId);
      notificationId = null;
    }

    // Clear timer state from DB
    const db = await getDb();
    await db.runAsync("DELETE FROM app_settings WHERE key = 'game_timer'");

    const gameId = timerGameId;
    timerStartTime = null;
    timerGameId = null;

    if (onStopCallback) {
      onStopCallback(elapsed, startTimeISO, endTime);
      onStopCallback = null;
    }

    if (responseListener) {
      responseListener.remove();
      responseListener = null;
    }
  }
}

export async function stopTimer(): Promise<{
  elapsedSeconds: number;
  startTime: string;
  endTime: string;
} | null> {
  if (!timerInterval || !timerStartTime) return null;

  clearInterval(timerInterval);
  timerInterval = null;

  const endTime = new Date().toISOString();
  const startTimeISO = new Date(timerStartTime).toISOString();
  const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);

  // Cancel notification
  if (notificationId) {
    await Notifications.dismissNotificationAsync(notificationId);
    notificationId = null;
  }

  // Clear timer state from DB
  const db = await getDb();
  await db.runAsync("DELETE FROM app_settings WHERE key = 'game_timer'");

  timerStartTime = null;
  const gameId = timerGameId;
  timerGameId = null;

  if (responseListener) {
    responseListener.remove();
    responseListener = null;
  }

  return { elapsedSeconds: elapsed, startTime: startTimeISO, endTime };
}

export function isTimerRunning(): boolean {
  return timerInterval !== null;
}

export function getTimerGameId(): number | null {
  return timerGameId;
}

export function getTimerElapsed(): number {
  if (!timerStartTime) return 0;
  return Math.floor((Date.now() - timerStartTime) / 1000);
}

// Restore timer from DB on app start
export async function restoreTimer(
  gameName: string,
  onStop?: (elapsedSeconds: number, startTime: string, endTime: string) => void
): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'game_timer'"
    );
    if (!row) return false;

    const { gameId, startTime } = JSON.parse(row.value);
    const startMs = new Date(startTime).getTime();
    const nowMs = Date.now();

    timerStartTime = startMs;
    timerGameId = gameId;
    onStopCallback = onStop ?? null;

    // Request permissions
    await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('game-timer', {
        name: '游戏计时',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    // Set up stop action handler
    if (responseListener) responseListener.remove();
    responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === 'stop') {
        handleStopFromNotification();
      }
    });

    const elapsed = Math.floor((nowMs - startMs) / 1000);
    await updateNotification(gameName, elapsed);

    timerInterval = setInterval(async () => {
      if (timerStartTime) {
        const e = Math.floor((Date.now() - timerStartTime) / 1000);
        await updateNotification(gameName, e);
      }
    }, 5000);

    return true;
  } catch {
    return false;
  }
}

// Format total play time (seconds) to readable string
export function formatPlayTime(totalSeconds: number): string {
  const s = Number(totalSeconds) || 0;
  if (s <= 0) return '0小时';
  const hours = s / 3600;
  if (hours < 1) return `${Math.round(s / 60)}分钟`;
  return `${hours.toFixed(1)}小时`;
}
