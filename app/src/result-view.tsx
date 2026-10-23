/* The finished result: the closest match, the other matches and the next step. Used right after
   a scan and again when a saved scan is reopened from History. */
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { percent, reading, type Output } from '@/model';
import { color, font, radius } from '@/theme';
import { Bars, MatchGauge, PhotoFrame, T, TextButton, useReveal, useWide } from '@/ui';

const SHOWN = 5;  // matches listed before "Show all"

export function ResultBody({ output, uri, animate = true, footer }: { output: Output; uri: string; animate?: boolean; footer?: ReactNode }) {
  const wide = useWide();
  const [all, setAll] = useState(false);
  const progress = useReveal(true, !animate);
  const ranked = useMemo(() => [...output.predictions].sort((a, b) => b.score - a.score), [output]);
  const [top, ...rest] = ranked;
  const read = reading(ranked);
  const nothing = read.title === 'Nothing fits';
  const listed = all ? rest : rest.slice(0, SHOWN - 1);
  const photo = <PhotoFrame uri={uri} height={200} />;

  return (
      <>
        {output.mock && <T v="small">These are sample values, not an analysis of your photo.</T>}

        <View style={s.verdict} accessible accessibilityLabel={nothing ? 'No clear match' : `Closest match: ${top.label}, ${percent(top.score)}`}>
          <View style={s.verdictMain}>
            {!nothing && <MatchGauge score={top.score} progress={progress} />}
            <View style={{ flex: 1, gap: 4 }}>
              <T v="label" style={{ color: color.onNight }}>Closest match</T>
              <T v="heading" style={{ color: color.panel, fontSize: 24, lineHeight: 28 }}>{nothing ? 'No clear match' : top.label}</T>
            </View>
          </View>
          <View style={s.readRule}>
            <T v="label" style={{ color: color.panel }}>{read.title}</T>
            <T style={{ color: color.onNight }}>{read.text}</T>
          </View>
        </View>

        {!wide && photo}

        {rest.length > 0 && (
          <View style={s.panel}>
            <T v="label" style={{ color: color.muted }}>Other matches</T>
            <Bars items={listed} progress={progress} />
            {rest.length > SHOWN - 1 && (
              <TextButton label={all ? 'Show fewer' : `Show all ${ranked.length} conditions`} onPress={() => setAll(!all)} />
            )}
          </View>
        )}

        <View style={s.next}>
          <T v="label" style={{ color: color.alert }}>Next step</T>
          <T style={{ color: color.alert }}>Show this result to a health worker or doctor. They can examine the skin, ask the right questions and confirm what is going on.</T>
          <T style={s.urgent}>If the area is painful, bleeding, spreading or changing quickly, seek care now.</T>
        </View>

        {!wide && <TextButton label="How to read this result" icon="info" onPress={() => router.push('/how-to-read')} />}
        <T v="small">Percentages show how closely the photo matches each condition the model knows. They are not a diagnosis.</T>
        {footer}
      </>
  );
}

const s = StyleSheet.create({
  verdict: { gap: 16, padding: 20, borderRadius: radius.lg, backgroundColor: color.ink },
  verdictMain: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  readRule: { gap: 3, paddingTop: 14, borderTopWidth: 1, borderTopColor: color.nightLine },
  panel: { gap: 14, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6, borderRadius: radius.md, backgroundColor: color.panel },
  next: { gap: 6, padding: 16, borderRadius: radius.md, backgroundColor: color.alertTint },
  urgent: { fontFamily: font.semibold, color: color.alert },
});
