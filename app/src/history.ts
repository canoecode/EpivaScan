/* Saved scans live on this device only (AsyncStorage). Nothing here is ever uploaded. The
   photo is kept as a link to wherever the camera or library put it, which a phone can clear
   or a browser forget; the app shows a plain tile when it can't load. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

import type { Output, Prediction } from '@/model';

export type SavedScan = { id: string; at: number; mock: boolean; model: string; uri: string; predictions: Prediction[] };

const KEY = 'epivascan.scans.v1';
const KEEP = 50;  // oldest scans drop off past this

export async function loadScans(): Promise<SavedScan[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedScan[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveScan(uri: string, output: Output): Promise<SavedScan> {
  const scan: SavedScan = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(), mock: output.mock, model: output.model, uri,
    predictions: [...output.predictions].sort((a, b) => b.score - a.score),
  };
  const list = [scan, ...(await loadScans())].slice(0, KEEP);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return scan;
}

export async function deleteScan(id: string) {
  await AsyncStorage.setItem(KEY, JSON.stringify((await loadScans()).filter((s) => s.id !== id)));
}

export async function clearScans() {
  await AsyncStorage.removeItem(KEY);
}

/* A yes/no question that works in the phone app and in a browser. */
export function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((done) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => done(false) },
    { text: action, style: 'destructive', onPress: () => done(true) },
  ], { cancelable: true, onDismiss: () => done(false) }));
}

export function when(at: number, now = Date.now()) {
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((day(now) - day(at)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
