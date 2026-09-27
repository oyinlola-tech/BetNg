import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Receipt } from "lucide-react-native";
import { BrandLogo, Button, FootballIcon, Text } from "../components";
import { ONBOARDING_PAGES, pageForOffset, type OnboardingArt, type OnboardingPage } from "../lib/onboarding";
import { useTheme } from "../theme";

const ART_WIDTH = 320;
const ART_HEIGHT = 220;
const STRIPES = 8;
const LINE = 1.5;

const MARKINGS: Readonly<Record<OnboardingArt, string>> = {
  centre: "M160 20V200M116 110a44 44 0 1 0 88 0a44 44 0 1 0-88 0",
  box: "M20 50H96V170H20M20 84H46V136H20M96 88a30 30 0 0 1 0 44",
  corner: "M20 174a26 26 0 0 0 26 26M20 200V146M20 146l24 9l-24 9",
};

const SPOTS: Readonly<Record<OnboardingArt, readonly [number, number]>> = {
  centre: [160, 110],
  box: [72, 110],
  corner: [20, 200],
};

function PitchArt({ art }: { readonly art: OnboardingArt }): React.JSX.Element {
  const t = useTheme();
  const [spotX, spotY] = SPOTS[art];
  const stripe = ART_WIDTH / STRIPES;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.art, { borderRadius: t.radius.lg, backgroundColor: t.colors.pitch }]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${String(ART_WIDTH)} ${String(ART_HEIGHT)}`} preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: STRIPES / 2 }, (_, index) => (
          <Rect key={index} x={index * 2 * stripe} y={0} width={stripe} height={ART_HEIGHT} fill={t.colors.pitchStripe} />
        ))}
        <Rect x={20} y={20} width={ART_WIDTH - 40} height={ART_HEIGHT - 40} stroke={t.colors.pitchLine} strokeWidth={LINE} fill="none" />
        <Path d={MARKINGS[art]} stroke={t.colors.pitchLine} strokeWidth={LINE} strokeLinejoin="round" fill="none" />
        <Circle cx={spotX} cy={spotY} r={2.5} fill={t.colors.pitchLine} />
      </Svg>
      <View
        style={[
          styles.tile,
          { borderRadius: t.radius.lg, backgroundColor: t.colors.surfaceElevated, borderColor: t.colors.border },
        ]}
      >
        {art === "corner" ? (
          <Receipt size={34} color={t.colors.brand} strokeWidth={1.75} />
        ) : (
          <FootballIcon name={art === "centre" ? "kickoff" : "goal"} size={36} color={t.colors.brand} />
        )}
      </View>
    </View>
  );
}

function Page({ page, width }: { readonly page: OnboardingPage; readonly width: number }): React.JSX.Element {
  const t = useTheme();

  return (
    <View style={{ width, paddingHorizontal: t.space[4], gap: t.space[8] }}>
      <PitchArt art={page.art} />
      <View style={{ gap: t.space[3] }}>
        <View style={styles.eyebrow}>
          <View style={{ width: 2, height: 12, backgroundColor: t.colors.brand }} />
          <Text variant="caps" tone="secondary">
            {page.eyebrow}
          </Text>
        </View>
        <Text variant="display" accessibilityRole="header">
          {page.title}
        </Text>
        <Text variant="body" tone="secondary" style={{ lineHeight: 22 }}>
          {page.body}
        </Text>
      </View>
    </View>
  );
}

export function OnboardingScreen({ onDone }: { readonly onDone: () => void }): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = ONBOARDING_PAGES.length;
  const last = index === count - 1;

  const go = useCallback(
    (next: number) => {
      pager.current?.scrollTo({ x: next * width, animated: !reducedMotion });
      setIndex(next);
    },
    [reducedMotion, width],
  );

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReducedMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index === 0) return false;

      go(index - 1);

      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [go, index]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setIndex(pageForOffset(event.nativeEvent.contentOffset.x, width, count));
  };

  return (
    <View style={[styles.fill, { backgroundColor: t.colors.background, paddingTop: insets.top + t.space[2] }]}>
      <View style={[styles.bar, { paddingHorizontal: t.space[4] }]}>
        <BrandLogo size={24} />
        {last ? null : <Button label="Skip" variant="ghost" size="md" onPress={onDone} style={{ paddingHorizontal: t.space[2] }} />}
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={settle}
        style={styles.fill}
        contentContainerStyle={styles.pages}
      >
        {ONBOARDING_PAGES.map((page) => (
          <Page key={page.key} page={page} width={width} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: t.space[4], paddingBottom: insets.bottom + t.space[4], gap: t.space[5] }}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Page ${String(index + 1)} of ${String(count)}`}
          accessibilityLiveRegion="polite"
          style={styles.dots}
        >
          {ONBOARDING_PAGES.map((page, position) => (
            <View
              key={page.key}
              style={{
                height: 6,
                width: position === index ? 20 : 6,
                borderRadius: t.radius.full,
                backgroundColor: position === index ? t.colors.brand : t.colors.borderStrong,
              }}
            />
          ))}
        </View>
        <Button
          label={last ? "Get started" : "Next"}
          size="lg"
          onPress={() => {
            if (last) onDone();
            else go(index + 1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 44 },
  pages: { alignItems: "center" },
  art: { width: "100%", aspectRatio: ART_WIDTH / ART_HEIGHT, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  tile: { position: "absolute", width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 6 },
});
