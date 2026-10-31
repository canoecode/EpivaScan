import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useScan } from '@/scan';
import { color } from '@/theme';
import { Button, Icon, Page, PhotoFrame, T, useWide } from '@/ui';

const CHECKS = ['In focus', 'One area, nothing covering it', 'Daylight, no flash glare'];

export default function Review() {
  const { photo, pick, clear } = useScan();
  const wide = useWide();
  if (!photo) return <Redirect href="/" />;

  const retake = () => { clear(); router.back(); };

  return (
    <Page
      back
      step="Step 1 of 2"
      actions={
        <>
          <Button label="Analyse photo" icon="focus" onPress={() => router.push('/result')} />
          <Button label={wide ? 'Choose another' : 'Retake'} icon={wide ? 'image' : 'camera'} kind="secondary" onPress={wide ? () => pick('library') : retake} />
        </>
      }
      aside={wide ? <PhotoFrame uri={photo.uri} /> : undefined}>
      <T v="title" accessibilityRole="header">Check the photo</T>
      {!wide && <PhotoFrame uri={photo.uri} />}
      {wide && <T v="lead">A clear photo gives a more useful result. Before you analyse it, make sure it is:</T>}
      <View style={{ gap: 10 }}>
        {CHECKS.map((c) => (
          <View key={c} style={s.check}>
            <Icon name="check" size={20} tint={color.signal} weight={2.2} />
            <T style={{ flex: 1 }}>{c}</T>
          </View>
        ))}
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
