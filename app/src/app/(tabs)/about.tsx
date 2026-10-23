import { StyleSheet, View } from 'react-native';

import { SPACE } from '@/model';
import { color, radius } from '@/theme';
import { Icon, Page, T } from '@/ui';

/* Copy comes from the website's About page. */
const PRINCIPLES: [string, string][] = [
  ['Clear, not clinical', 'Plain percentages and plain language that anyone can read without training.'],
  ['Honest about limits', 'We say what the model can’t do as plainly as what it can, and plan to publish how it performs.'],
  ['Built for the field', 'Made for a phone in someone’s hand, in places where specialists are far away.'],
];

export default function About() {
  return (
    <Page tab>
      <View style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">About</T>
        <T v="body">Skin care shouldn’t depend on where you live.</T>
      </View>
      <T>EpivaScan is building a simple way to get a first read on a skin concern, for the many people who can’t easily reach a dermatologist. It is a tool for the person who is already there, and never a replacement for a doctor.</T>

      <View style={s.privacy}>
        <View style={s.privacyHead}>
          <Icon name="lock" size={20} tint={color.signalTint} />
          <T v="label" style={{ color: color.panel, fontSize: 17 }}>Photos are health data</T>
        </View>
        <T style={{ color: color.onNight }}>
          {SPACE
            ? 'Your photo is sent to the EpivaScan model for analysis. Saved scans stay on this phone and you can delete them from History any time.'
            : 'In test mode your photo stays on this phone and is never uploaded. A full privacy policy will be published before the model goes live.'}
        </T>
      </View>

      <View style={s.list}>
        {PRINCIPLES.map(([a, b], i) => (
          <View key={a} style={[s.row, i > 0 && s.rule]}>
            <T v="label" style={{ fontSize: 16 }}>{a}</T>
            <T v="small" style={{ lineHeight: 20, color: color.ink2 }}>{b}</T>
          </View>
        ))}
      </View>

      <T v="small">EpivaScan is a screening aid in development. It is not a medical device and does not give a diagnosis. Questions, partnerships or a community that could use it? Contact details are coming soon.</T>
    </Page>
  );
}

const s = StyleSheet.create({
  privacy: { gap: 8, padding: 16, borderRadius: radius.md, backgroundColor: color.ink },
  privacyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { borderRadius: radius.md, backgroundColor: color.panel },
  row: { gap: 2, paddingHorizontal: 16, paddingVertical: 12 },
  rule: { borderTopWidth: 1, borderTopColor: color.ground },
});
