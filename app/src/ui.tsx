/* Shared building blocks. Every screen is built from these, so the phone app and the
   desktop-browser layout stay one design. */
import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { percent, type Prediction } from '@/model';
import { WIDE, color, font, radius } from '@/theme';

export const useWide = () => useWindowDimensions().width >= WIDE;

/* Respect the system "reduce motion" setting everywhere something moves. */
export function useCalm() {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setCalm);
    return () => sub.remove();
  }, []);
  return calm;
}

/* ---- Type ---------------------------------------------------------------- */
type Variant = 'display' | 'title' | 'heading' | 'lead' | 'body' | 'label' | 'small' | 'num';
export function T({ v = 'body', style, ...props }: TextProps & { v?: Variant; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[type[v], style]} />;
}

/* ---- Icons: one stroke family, drawn rather than borrowed ---------------- */
const ICONS = {
  camera: <><Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.2-2h6.2l1.2 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><Circle cx={12} cy={12.5} r={3.5} /></>,
  image: <><Rect x={3.5} y={5} width={17} height={14} rx={2.5} /><Circle cx={9} cy={10} r={1.6} /><Path d="M4 17l4.5-4 3.5 3 3-2.5 5 4" /></>,
  sun: <><Circle cx={12} cy={12} r={4} /><Path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
  frame: <><Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><Circle cx={12} cy={12} r={3.5} /></>,
  focus: <><Circle cx={12} cy={12} r={8.5} /><Circle cx={12} cy={12} r={2} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  area: <><Path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><Circle cx={12} cy={10} r={2.5} /></>,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <Path d="M15 5l-7 7 7 7" />,
  info: <><Circle cx={12} cy={12} r={8.5} /><Path d="M12 11v5.5M12 7.6v.4" /></>,
  scan: <><Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><Circle cx={12} cy={12} r={3.5} /></>,
  history: <><Circle cx={12} cy={12} r={8.5} /><Path d="M12 7.5V12l3 2" /></>,
  learn: <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" />,
  about: <><Circle cx={12} cy={12} r={8.5} /><Path d="M12 11v5.5M12 7.6v.4" /></>,
  chevron: <Path d="M9 5l7 7-7 7" />,
  down: <Path d="M5 9l7 7 7-7" />,
  trash: <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  lock: <><Rect x={5} y={11} width={14} height={9} rx={2} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};
export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 22, tint = color.ink, weight = 1.8 }: { name: IconName; size?: number; tint?: string; weight?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}

/* ---- Logo and the six-tone ring ------------------------------------------ */
const RING = [
  ['#EDC4A4', 'M24.09 5.98A14.6 14.6 0 0 1 30.09 9.45'],
  ['#E0A980', 'M34.18 16.54A14.6 14.6 0 0 1 34.18 23.46'],
  ['#C98B62', 'M30.09 30.55A14.6 14.6 0 0 1 24.09 34.02'],
  ['#A56C47', 'M15.91 34.02A14.6 14.6 0 0 1 9.91 30.55'],
  ['#77472D', 'M5.82 23.46A14.6 14.6 0 0 1 5.82 16.54'],
  ['#472A1B', 'M9.91 9.45A14.6 14.6 0 0 1 15.91 5.98'],
];
export function ToneRing({ size, dot = true }: { size: number; dot?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {RING.map(([stroke, d]) => <Path key={d} d={d} stroke={stroke} strokeWidth={6} strokeLinecap="round" fill="none" />)}
      {dot && <Circle cx={20} cy={20} r={5.6} fill="#C25E38" />}
    </Svg>
  );
}

export function Logo({ size = 30, onDark }: { size?: number; onDark?: boolean }) {
  return (
    <View style={s.logo} accessibilityRole="header" accessibilityLabel="EpivaScan">
      <ToneRing size={size} />
      <Text style={[s.wordmark, onDark && { color: color.panel }]} importantForAccessibility="no">EpivaScan</Text>
    </View>
  );
}

/* ---- Buttons ------------------------------------------------------------- */
type Kind = 'primary' | 'secondary' | 'onDark';
export function Button({ label, onPress, kind = 'primary', icon, disabled, style }: {
  label: string; onPress: () => void; kind?: Kind; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        s.btn, btnKind[kind], (pressed || hovered) && btnOn[kind],
        pressed && { transform: [{ scale: 0.98 }] }, disabled && s.btnDisabled, style,
      ]}>
      {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const fg = kind === 'secondary' && !(pressed || hovered) ? color.ink : kind === 'onDark' && (pressed || hovered) ? color.ink : color.panel;
        return (
          <>
            {icon && <Icon name={icon} tint={fg} />}
            <Text style={[s.btnText, { color: fg }]}>{label}</Text>
          </>
        );
      }}
    </Pressable>
  );
}

export function TextButton({ label, onPress, icon, tint = color.signal }: { label: string; onPress: () => void; icon?: IconName; tint?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12} style={s.textBtn}>
      {icon && <Icon name={icon} size={20} tint={tint} weight={2} />}
      <Text style={[s.textBtnText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

/* ---- Status --------------------------------------------------------------- */
export function Notice({ children, tone = 'alert' }: { children: ReactNode; tone?: 'alert' | 'signal' }) {
  return (
    <View style={[s.notice, tone === 'signal' && { backgroundColor: color.signalTint }]} accessibilityRole="alert">
      <Text style={[s.noticeText, tone === 'signal' && { color: color.signalDeep }]}>{children}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'alert' }: { label: string; tone?: 'alert' | 'signal' }) {
  const fg = tone === 'alert' ? color.alert : color.signalDeep;
  return (
    <View style={[s.pill, { backgroundColor: tone === 'alert' ? color.alertTint : color.signalTint }]}>
      <View style={[s.pillDot, { backgroundColor: fg }]} />
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* The tab bar's desktop-browser counterpart: the same four places, as a header nav. */
const NAV: { href: '/' | '/history' | '/learn' | '/about'; label: string }[] = [
  { href: '/', label: 'Scan' }, { href: '/history', label: 'History' }, { href: '/learn', label: 'Learn' }, { href: '/about', label: 'About' },
];
function WideNav({ dark }: { dark?: boolean }) {
  const path = usePathname();
  return (
    <View style={{ flexDirection: 'row', gap: 28 }} accessibilityRole="menu">
      {NAV.map(({ href, label }) => {
        const on = href === '/' ? path === '/' || path === '/review' || path === '/result' : path.startsWith(href);
        return (
          <Pressable key={href} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => router.navigate(href)} style={[s.navItem, on && { borderBottomColor: color.signal }]}>
            <Text style={[s.navText, { color: dark ? (on ? color.panel : color.onNight) : on ? color.ink : color.ink2 }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---- Page shell ----------------------------------------------------------
   Phone: a top bar (or a full-bleed hero), scrolling content, and the main actions pinned
   within thumb reach. Desktop browser: a site-style header, a centred column, actions inline.
   `dark` is the camera context: the review and analysing screens. */
export function Page({ children, actions, back, step, aside, hero, dark, tab }: {
  children: ReactNode; actions?: ReactNode; back?: boolean; step?: ReactNode; aside?: ReactNode; hero?: ReactNode; dark?: boolean; tab?: boolean;
}) {
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const backButton = <TextButton label="Back" icon="back" tint={dark ? color.panel : color.signal} onPress={goBack} />;
  const stepNode = typeof step === 'string' ? <T v="label" style={{ color: dark ? color.onNight : color.muted }}>{step}</T> : step;

  if (wide) {
    return (
      <View style={[s.wideRoot, dark && s.dark]}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <View style={[s.wideHeader, dark && { borderBottomColor: color.nightLine, backgroundColor: color.ink }]}>
          <View style={s.wideHeaderInner}>
            <Pressable accessibilityRole="link" onPress={() => router.replace('/')}><Logo size={32} onDark={dark} /></Pressable>
            <View style={{ flex: 1 }} />
            <WideNav dark={dark} />
          </View>
        </View>
        <ScrollView contentContainerStyle={s.wideScroll}>
          <View style={s.wideInner}>
            {(back || step) && <View style={s.wideBack}>{back ? backButton : <View />}{stepNode}</View>}
            {aside ? (
              <View style={s.wideColumns}>
                <View style={s.wideMain}>{hero}{children}{actions && <View style={s.wideActions}>{actions}</View>}</View>
                <View style={s.wideAside}>{aside}</View>
              </View>
            ) : (
              <View style={{ gap: 20, maxWidth: 720 }}>{hero}{children}{actions && <View style={s.wideActions}>{actions}</View>}</View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.root, dark && s.dark]} edges={[...(hero ? [] : ['top']), ...(tab ? [] : ['bottom'])] as ('top' | 'bottom')[]}>
      <StatusBar style={dark || hero ? 'light' : 'dark'} />
      {!hero && (
        <View style={s.bar}>
          {back ? backButton : <Logo onDark={dark} />}
          <View style={{ flex: 1 }} />
          {stepNode}
        </View>
      )}
      <ScrollView contentContainerStyle={[s.scroll, hero ? { paddingTop: 0, paddingHorizontal: 0 } : null]}>
        {hero && <View style={{ paddingTop: insets.top }}>{hero}</View>}
        <View style={hero ? { paddingHorizontal: 24, gap: 20 } : { gap: 20 }}>{children}{aside}</View>
      </ScrollView>
      {actions && <View style={[s.actions, dark && { backgroundColor: color.ink, borderTopColor: color.nightLine }]}>{actions}</View>}
    </SafeAreaView>
  );
}

/* ---- The photo, framed like a viewfinder --------------------------------- */
export function PhotoFrame({ uri, scanning, height }: { uri: string; scanning?: boolean; height?: number }) {
  const [box, setBox] = useState(0);
  const [broken, setBroken] = useState(false);
  const y = useRef(new Animated.Value(0)).current;
  const calm = useCalm();

  useEffect(() => {
    if (!scanning || calm || !box) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: box - 3, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(y, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scanning, calm, box, y]);

  return (
    <View style={[s.frame, height ? { height } : { aspectRatio: 4 / 5 }]} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
      {broken ? (
        <View style={[StyleSheet.absoluteFill, s.gone]}>
          <T v="small" style={{ color: color.onNight, textAlign: 'center' }}>This photo is no longer on the device.</T>
        </View>
      ) : (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Your photo" onError={() => setBroken(true)} />
      )}
      {!broken && <View style={s.brackets} pointerEvents="none">
        <View style={[s.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 }]} />
        <View style={[s.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 }]} />
        <View style={[s.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 }]} />
        <View style={[s.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 }]} />
      </View>}
      {scanning && !calm && <Animated.View style={[s.scanLine, { transform: [{ translateY: y }] }]} />}
    </View>
  );
}

/* ---- The signature move: how closely the photo matches, drawn as the logo's ring.
   It sweeps in once when a result arrives (not at all with reduce motion). */
export function useReveal(run: boolean, instant = false) {
  const calm = useCalm();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    if (calm || instant) { progress.setValue(1); return; }
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 900, delay: 120, easing: Easing.out(Easing.exp), useNativeDriver: false }).start();
  }, [run, calm, instant, progress]);
  return progress;
}

export function MatchGauge({ score, progress, size = 104 }: { score: number; progress: Animated.Value; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  // Read the animation through a listener: an animated SVG circle leaks native-only props on web.
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => setT(value));
    return () => progress.removeListener(id);
  }, [progress]);
  const offset = length * (1 - Math.max(score, 0.01) * t);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.nightLine} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color.signalTint} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${length} ${length}`} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={s.gaugeText}>{percent(score)}</Text>
    </View>
  );
}

/* ---- Ranked matches ------------------------------------------------------- */
export function Bars({ items, progress }: { items: Prediction[]; progress?: Animated.Value }) {
  return (
    <View style={{ gap: 16 }} accessibilityRole="list">
      {items.map((item) => {
        const target = `${Math.max(item.score * 100, 0.5)}%`;
        const width = progress ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', target] }) : target;
        return (
          <View key={item.label} style={{ gap: 7 }} accessible accessibilityLabel={`${item.label}, ${percent(item.score)}`}>
            <View style={s.barTop}>
              <T style={{ flex: 1, color: color.ink, fontFamily: font.medium }}>{item.label}</T>
              <T v="num">{percent(item.score)}</T>
            </View>
            <View style={s.track}>
              <Animated.View style={[s.fill, { width }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ---- Photo tips ----------------------------------------------------------- */
const TIPS: [IconName, string, string][] = [
  ['sun', 'Good light', 'Daylight, no harsh flash'],
  ['frame', 'Fill the frame', 'About a hand’s width away'],
  ['focus', 'Keep it sharp', 'Retake if it’s blurred'],
  ['area', 'One area', 'Nothing covering the skin'],
];
export function Tips() {
  return (
    <View style={s.card}>
      {TIPS.map(([icon, title, text], i) => (
        <View key={title} style={[s.tip, i > 0 && s.tipRule]}>
          <View style={s.tipIcon}><Icon name={icon} size={20} tint={color.signal} /></View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: font.semibold, color: color.ink }}>{title}</T>
            <T v="small">{text}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---- Styles --------------------------------------------------------------- */
const type = StyleSheet.create({
  display: { fontFamily: font.semibold, fontSize: 38, lineHeight: 41, letterSpacing: -1.5, color: color.ink },
  title: { fontFamily: font.semibold, fontSize: 30, lineHeight: 34, letterSpacing: -0.9, color: color.ink },
  heading: { fontFamily: font.semibold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: color.ink },
  lead: { fontFamily: font.regular, fontSize: 18, lineHeight: 26, color: color.ink2 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23, color: color.ink2 },
  label: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: color.ink },
  small: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: color.muted },
  num: { fontFamily: font.mono, fontSize: 15, lineHeight: 20, color: color.ink, fontVariant: ['tabular-nums'] },
});

const btnKind = StyleSheet.create({
  primary: { backgroundColor: color.signal, borderColor: color.signal },
  secondary: { backgroundColor: 'transparent', borderColor: color.ink },
  onDark: { backgroundColor: 'transparent', borderColor: color.onNight },
});
const btnOn = StyleSheet.create({
  primary: { backgroundColor: color.signalDeep, borderColor: color.signalDeep },
  secondary: { backgroundColor: color.ink },
  onDark: { backgroundColor: color.panel, borderColor: color.panel },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  dark: { backgroundColor: color.ink },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 24 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 20 },
  actions: { gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.ground },

  wideRoot: { flex: 1, backgroundColor: color.ground },
  wideHeader: { borderBottomWidth: 1, borderBottomColor: color.line, backgroundColor: color.ground },
  wideHeaderInner: { flexDirection: 'row', alignItems: 'center', minHeight: 76, width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 40 },
  wideScroll: { paddingVertical: 48, paddingHorizontal: 40 },
  wideInner: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 20 },
  wideBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  wideColumns: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  wideMain: { flex: 1, gap: 20 },
  wideAside: { width: 440, gap: 20 },
  wideActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },

  navItem: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navText: { fontFamily: font.medium, fontSize: 16 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontFamily: font.bold, fontSize: 21, letterSpacing: -0.7, color: color.ink },

  btn: { flexDirection: 'row', gap: 10, minHeight: 56, paddingHorizontal: 24, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: font.semibold, fontSize: 17 },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  textBtnText: { fontFamily: font.semibold, fontSize: 16 },

  notice: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.sm, backgroundColor: color.alertTint },
  noticeText: { fontFamily: font.medium, fontSize: 15, lineHeight: 21, color: color.alert },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: font.semibold, fontSize: 13, lineHeight: 17 },

  frame: { width: '100%', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: color.ink },
  brackets: { position: 'absolute', top: '11%', bottom: '11%', left: '13%', right: '13%' },
  gone: { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: color.nightLine },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: color.signal },
  scanLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: color.signal },

  gaugeText: { fontFamily: font.semibold, fontSize: 26, letterSpacing: -0.8, color: color.panel, fontVariant: ['tabular-nums'] },

  barTop: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: color.ground },
  fill: { height: '100%', borderRadius: 4, backgroundColor: color.muted },

  card: { borderRadius: radius.md, backgroundColor: color.panel },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  tipRule: { borderTopWidth: 1, borderTopColor: color.ground },
  tipIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: color.signalTint },
});
