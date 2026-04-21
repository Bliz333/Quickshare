import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuickShareSessionState } from '../types/quickshare';

const SESSION_STORAGE_KEY = 'quickshare.mobile.session';
const DEVICE_ID_STORAGE_KEY = 'quickshare.mobile.deviceId';

function createDeviceId(): string {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadStoredSession(): Promise<QuickShareSessionState | null> {
  const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as QuickShareSessionState;
    if (!parsed?.token || !parsed?.user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredSession(session: QuickShareSessionState): Promise<void> {
  await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function loadStoredDeviceId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  return raw?.trim() ? raw.trim() : null;
}

export async function loadOrCreateStoredDeviceId(): Promise<string> {
  const existing = await loadStoredDeviceId();
  if (existing) {
    return existing;
  }

  const nextDeviceId = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}
