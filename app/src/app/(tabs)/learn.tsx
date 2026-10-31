import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { READINGS } from '@/model';
import { color, font, radius } from '@/theme';
import { Icon, Page, T } from '@/ui';

/* Copy comes from the website's How it works page, so the two never disagree. */
const STEPS: [string, string][] = [
  ['Capture the area', 'Photograph the patch of skin you’re concerned about, or choose a picture you already have.'],
  ['The model takes a look', 'The photo is compared against the skin conditions the EpivaScan model has been trained to recognise.'],
  ['Read the matches', 'You get a ranked list of conditions, closest match first, each with a percentage showing how strongly the photo matches it.'],
  ['Take it to a clinician', 'Use the result as a starting point. Show it to a health worker or doctor, who can examine the skin and confirm what is going on.'],
];

const PHOTO: [string, string][] = [
  ['Use good light', 'Daylight near a window is ideal. Avoid harsh flash and deep shadow.'],
  ['Fill the frame', 'Hold the phone about a hand’s width away so the area takes up most of the picture.'],
  ['Keep it sharp', 'Tap to focus, hold steady, and retake the photo if it comes out blurred.'],
  ['One area at a time', 'Scan each patch separately, with nothing covering it: no hair, clothing or cream.'],
];

const LIMITS: [string, string][] = [
  ['It doesn’t diagnose.', 'It suggests which conditions a photo resembles. A clinician confirms.'],
  ['It doesn’t prescribe.', 'Treatment decisions belong to a qualified health professional.'],
  ['It can’t examine you.', 'It can’t feel texture, take a history or see the rest of your skin.'],
  ['It isn’t for emergencies.', 'If something is painful, bleeding, spreading or changing fast, seek care now.'],
];

const Point = ({ a, b }: { a: string; b: string }) => (
  <View><T style={s.strong}>{a}</T><T v="small" style={s.detail}>{b}</T></View>
);

type Section = { title: string; sub: string; body: () => ReactNode };
const SECTIONS: Section[] = [
  {
    title: 'How it works', sub: 'Four moves, from photo to a next step',
    body: () => STEPS.map(([a, b], i) => (
      <View key={a} style={s.step}>
        <T v="num" style={{ color: color.signal, width: 14 }}>{i + 1}</T>
        <View style={{ flex: 1 }}><Point a={a} b={b} /></View>
      </View>
    )),
  },
  { title: 'Getting a good photo', sub: 'Light, framing, focus', body: () => PHOTO.map(([a, b]) => <Point key={a} a={a} b={b} />) },
  {
    title: 'Reading the result', sub: 'What the percentages mean',
    body: () => (
      <>
        <T v="small" style={s.detail}>Each percentage shows how closely the photo matches a condition. It is not the chance that you have it, and a high percentage is not a diagnosis.</T>
        {Object.values(READINGS).map((r) => <Point key={r.title} a={r.title} b={r.text} />)}
      </>
    ),
  },
  { title: 'Know the limits', sub: 'What EpivaScan doesn’t do', body: () => LIMITS.map(([a, b]) => <Point key={a} a={a} b={b} />) },
];

export default function Learn() {
  const [open, setOpen] = useState(0);
  return (
    <Page tab>
      <View style={{ gap: 8 }}>
        <T v="title" accessibilityRole="header">Learn</T>
        <T v="body">What EpivaScan does, and what it doesn’t.</T>
      </View>
      <View style={{ gap: 10 }}>
        {SECTIONS.map((sec, i) => {
          const on = open === i;
          return (
            <View key={sec.title} style={s.card}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(on ? -1 : i)} style={s.head}>
                <View style={{ flex: 1 }}>
                  <T style={s.title}>{sec.title}</T>
                  <T v="small">{sec.sub}</T>
                </View>
                <Icon name={on ? 'down' : 'chevron'} size={22} tint={color.signal} weight={2} />
              </Pressable>
              {on && <View style={s.body}>{sec.body()}</View>}
            </View>
          );
        })}
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.md, backgroundColor: color.panel, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.3, color: color.ink },
  body: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  step: { flexDirection: 'row', gap: 12 },
  strong: { fontFamily: font.semibold, fontSize: 15, color: color.ink },
  detail: { lineHeight: 20, color: color.ink2 },
});
