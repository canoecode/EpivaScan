import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { clearScans, confirm, loadScans, when, type SavedScan } from '@/history';
import { percent, reading } from '@/model';
import { color, font, radius } from '@/theme';
import { Button, Icon, Page, Pill, T, TextButton } from '@/ui';

function Thumb({ uri }: { uri: string }) {
  const [broken, setBroken] = useState(false);
  return broken
    ? <View style={[s.thumb, { backgroundColor: color.tones[2] }]} accessibilityLabel="Photo no longer available" />
    : <Image source={{ uri }} style={s.thumb} onError={() => setBroken(true)} accessibilityLabel="Scan photo" />;
}

export default function History() {
  const [scans, setScans] = useState<SavedScan[] | null>(null);
  useFocusEffect(useCallback(() => { loadScans().then(setScans); }, []));

  const clearAll = async () => {
    if (await confirm('Delete all scans?', 'Every saved scan will be removed from this phone.', 'Delete all')) {
      await clearScans();
      setScans([]);
    }
  };

  return (
    <Page tab>
      <View style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">History</T>
        <T v="body">Your scans, saved on this phone only.</T>
      </View>

      {scans && scans.length === 0 && (
        <View style={s.empty}>
          <Icon name="history" size={30} tint={color.signal} />
          <T v="heading">No scans yet</T>
          <T v="body" style={{ textAlign: 'center' }}>A scan you make shows up here, so you can show it to a health worker later.</T>
          <Button label="Scan a photo" icon="camera" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      )}

      {scans && scans.length > 0 && (
        <>
          <View style={s.list}>
            {scans.map((scan, i) => {
              const top = scan.predictions[0];
              const none = reading(scan.predictions).title === 'Nothing fits';
              return (
                <Pressable
                  key={scan.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${none ? 'No clear match' : top.label}, ${when(scan.at)}`}
                  onPress={() => router.push({ pathname: '/scan/[id]', params: { id: scan.id } })}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.row, i > 0 && s.rule, (pressed || hovered) && { backgroundColor: color.ground }]}>
                  <Thumb uri={scan.uri} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T style={{ fontFamily: font.semibold, color: color.ink }}>{none ? 'No clear match' : top.label}</T>
                    <View style={s.meta}>
                      <T v="small">{when(scan.at)}</T>
                      {scan.mock && <Pill label="Sample" />}
                    </View>
                  </View>
                  {!none && <T v="num">{percent(top.score)}</T>}
                  <Icon name="chevron" size={20} tint={color.lineStrong} />
                </Pressable>
              );
            })}
          </View>
          <TextButton label="Delete all scans" icon="trash" tint={color.alert} onPress={clearAll} />
          <T v="small">Scans never leave this phone. Delete them any time.</T>
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  list: { borderRadius: radius.md, backgroundColor: color.panel, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rule: { borderTopWidth: 1, borderTopColor: color.ground },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: color.ground2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { gap: 10, alignItems: 'center', padding: 28, borderRadius: radius.lg, backgroundColor: color.panel },
});
