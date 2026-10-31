import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { SPACE } from '@/model';
import { useScan } from '@/scan';
import { color, radius } from '@/theme';
import { Button, Icon, Logo, Notice, Page, Pill, T, TextButton, Tips, ToneRing, useWide } from '@/ui';

export default function Home() {
  const { pick, problem } = useScan();
  const wide = useWide();
  // A desktop browser has no camera worth framing skin with; it gets drop and paste instead.
  const desktop = wide && Platform.OS === 'web';

  const actions = desktop ? (
    <Button label="Choose a photo" icon="image" onPress={() => pick('library')} />
  ) : (
    <>
      <Button label="Take a photo" icon="camera" onPress={() => pick('camera')} />
      <Button label="Choose from photos" icon="image" kind="secondary" onPress={() => pick('library')} />
    </>
  );

  /* The committed shell: an ink panel carrying the six-tone ring, the product's own mark. */
  const hero = (
    <View style={[s.hero, wide && s.heroWide]}>
      {!wide && <Logo onDark />}
      <View style={s.heroTop}>
        <View style={{ flex: 1, gap: 14 }}>
          <T v="display" accessibilityRole="header" style={[{ color: color.panel }, wide && s.wideDisplay]}>Check a skin concern from one photo.</T>
          <T v="body" style={{ color: color.onNight, fontSize: wide ? 18 : 16, lineHeight: wide ? 27 : 24 }}>
            See which conditions it most closely matches, each with a percentage. A first step toward the right care, not a diagnosis.
          </T>
        </View>
        {wide && <ToneRing size={116} dot={false} />}
      </View>
      <View style={s.heroFoot}>
        {SPACE ? <Pill tone="signal" label="Connected to the EpivaScan model" /> : <Pill label="Test mode · sample values" />}
        {!wide && <ToneRing size={64} dot={false} />}
      </View>
    </View>
  );

  const note = SPACE
    ? 'Your photo is sent to the EpivaScan model for analysis.'
    : 'The model is still being trained, so every photo gets the same sample values. Photos stay on this device.';

  if (desktop) {
    return (
      <Page
        tab
        hero={hero}
        actions={actions}
        aside={
          <>
            <View style={s.drop}>
              <Icon name="image" size={30} tint={color.signal} />
              <T v="heading">Drop a photo here</T>
              <T v="small">or paste one from your clipboard</T>
            </View>
            <Tips />
          </>
        }>
        <T v="small">{note}</T>
        {problem && <Notice>{problem}</Notice>}
      </Page>
    );
  }

  return (
    <Page tab hero={hero} actions={actions}>
      {problem && <Notice>{problem}</Notice>}
      <View style={{ gap: 10 }}>
        <T v="label" style={{ color: color.muted }}>For a clear photo</T>
        <Tips />
      </View>
      <T v="small">{note}</T>
      <View style={s.footer}>
        <TextButton label="How to read results" icon="info" onPress={() => router.push('/how-to-read')} />
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  hero: {
    gap: 18, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 26, backgroundColor: color.ink,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroWide: { borderRadius: radius.lg, padding: 36, gap: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -4 },
  wideDisplay: { fontSize: 46, lineHeight: 49, letterSpacing: -1.9 },
  drop: {
    gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 200, padding: 24,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.lineStrong, borderRadius: radius.lg,
  },
  footer: { alignItems: 'center' },
});
