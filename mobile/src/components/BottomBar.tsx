// The role's bottom tab bar: two main pages, the Start tile (the role's Start menu: new requests and things waiting
// on you), two main pages. The rest of the role's pages are in the profile panel, opened from the avatar at the
// top left (components/MenuDrawer).

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName, NavItem } from '~/nav';
import { useTheme } from '~/lib/theme';
import { go } from '~/lib/go';
import { ComposeIcon } from './icons';
import { StartSheet } from './TopBar';
import { font } from './ui';

const TILE = 56;
const RING = TILE + 12;

export function BottomBar({ tabs, path }: { tabs: NavItem[]; path: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState(false);
  // Home (/employee) only matches itself; other tabs also match their sub-pages.
  const active = tabs.filter((t) => path === t.to || (t.to.split('/').length > 2 && path.startsWith(`${t.to}/`))).sort((a, b) => b.to.length - a.to.length)[0];
  // The middle cell holds the Start label, on the same line as the other tabs' names; the circle itself is raised
  // over the bar's top edge (see below).
  const startTile = (
    <View key="start" style={styles.tab}>
      {/* Same height as a tab's icon pill, so "Start" sits on the same line as the other names. */}
      <View style={{ height: 32 }} />
      <Text style={[{ fontSize: 10, color: start ? c.accent : c.muted }, font(start ? '600' : '500')]}>Start</Text>
    </View>
  );

  return (
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: c.surfaceRaised, borderColor: c.border, shadowColor: c.text, marginBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((t, n) => {
        const on = active === t;
        const icon = t.icon ?? 'ellipse-outline';
        const tab = (
          <Pressable key={t.to} onPress={() => go(t.to)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} style={styles.tab}>
            <View style={[styles.pill, on && { backgroundColor: c.accentSoft }]}>
              <Ionicons name={on ? (icon.replace('-outline', '') as IconName) : icon} size={22} color={on ? c.accent : c.muted} />
            </View>
            <Text numberOfLines={1} style={[{ fontSize: 10, color: on ? c.accent : c.muted }, font(on ? '600' : '500')]}>
              {t.short ?? t.label}
            </Text>
          </Pressable>
        );
        // The Start tile sits in the middle, after the first two tabs.
        return n === 2 ? [startTile, tab] : tab;
      })}
      {tabs.length < 3 && startTile}

      {/* The Start circle, overlapping the bar: the brand gradient, set into the bar by a ring in the page colour. */}
      <View style={[styles.startRing, { backgroundColor: c.bg }]}>
        <Pressable onPress={() => setStart(true)} accessibilityRole="button" accessibilityLabel="Start" accessibilityState={{ expanded: start }} style={({ pressed }) => [styles.start, { shadowColor: c.gradEnd, opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient colors={[c.gradStart, c.gradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.startFill}>
            <ComposeIcon size={26} color={c.onAccent} />
          </LinearGradient>
        </Pressable>
      </View>
      <StartSheet open={start} onClose={() => setStart(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // A floating pill, lifted off the screen edges.
  bar: { flexDirection: 'row', marginHorizontal: 12, paddingVertical: 8, paddingHorizontal: 8, borderWidth: 1, borderRadius: radius.pill, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48 },
  startRing: { position: 'absolute', top: -28, left: '50%', marginLeft: -RING / 2, width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' },
  start: { width: TILE, height: TILE, borderRadius: TILE / 2, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  startFill: { flex: 1, borderRadius: TILE / 2, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
