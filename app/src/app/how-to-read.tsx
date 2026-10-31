import { StyleSheet, View } from 'react-native';

import { READINGS } from '@/model';
import { color, radius } from '@/theme';
import { Page, T } from '@/ui';

export default function HowToRead() {
  return (
    <Page back>
      <T v="title" accessibilityRole="header">How to read a result</T>
      <T v="lead">Each percentage shows how closely your photo matches a condition the model knows. It is not the chance that you have it, and it is not a diagnosis.</T>

      <View style={{ gap: 12 }}>
        <T v="heading">Three kinds of result</T>
        {Object.values(READINGS).map((r) => (
          <View key={r.title} style={s.row}>
            <T v="label">{r.title}</T>
            <T>{r.text}</T>
          </View>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <T v="heading">Whatever the result</T>
        <T>Show it to a health worker or doctor. They can examine the skin and confirm what is going on.</T>
        <T style={{ color: color.alert }}>If the area is painful, bleeding, spreading or changing quickly, seek care now.</T>
      </View>
    </Page>
  );
}

const s = StyleSheet.create({
  row: { gap: 4, padding: 16, borderRadius: radius.md, backgroundColor: color.panel },
});
