// The profile panel, opened from the avatar at the top left: a frosted panel that slides in from the left (the
// Glass look) with the signed-in person on a card, then the role's pages that aren't bottom tabs, grouped like the
// website's sidebar (sections fold), then the theme and Log out. A scrim in the page colour covers the rest of the
// screen; tapping it, Escape (web) or opening a page closes it, and focus returns to the avatar.
// Motion: transform and opacity only; under reduce motion it appears without sliding.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavGroup } from '~/nav';
import { useTheme, type ThemePreference } from '~/lib/theme';
import { useSession } from '~/session';
import { Segmented } from './sheets';
import { Button, font, T } from './ui';
import { useReducedMotion } from '~/lib/useReducedMotion';


export function ProfilePanel({ open, onClose, go, groups, path }: { open: boolean; onClose: () => void; go: (to: string) => void; groups: NavGroup[]; path: string }) {
  const { c, dark, look, preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const reduced = useReducedMotion();
  const w = Math.min(340, width * 0.86);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) v.setValue(open ? 1 : 0);
    else Animated.timing(v, { toValue: open ? 1 : 0, duration: open ? 260 : 160, easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [open, reduced, v]);

  // Escape closes it on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* The scrim: the page colour at 72%, over everything while the panel is open. */}
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { opacity: v, zIndex: 40 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, opacity: 0.72 }]} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        nativeID="profile-panel"
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        style={[styles.panel, { width: w, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12, borderColor: c.border, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w - 24, 0] }) }] }]}
      >
        <LinearGradient colors={look.wash(c, dark)} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }} style={[StyleSheet.absoluteFill, styles.fill]} />

        <View style={styles.head}>
          {/* Employees open their details from here (other workspaces have no My details page yet). */}
          <Pressable
            onPress={() => go('/employee/my-details')}
            disabled={user?.workspace !== 'employee'}
            accessibilityRole="button"
            accessibilityLabel={`${user?.name ?? ''}, my details`}
            style={({ pressed }) => [styles.who, { borderRadius: 12, backgroundColor: pressed ? c.tint : 'transparent' }]}
          >
            <View style={[styles.avatar, { backgroundColor: c.gradEnd }]}>
              <Text style={[{ color: c.onAccent, fontSize: 15 }, font('600')]}>{user?.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <T size={15} weight="600" numberOfLines={1}>
                {user?.name}
              </T>
              <T size={12} muted>
                {user?.roleName}
              </T>
              <T size={12} muted numberOfLines={1}>
                {user?.account.username}
              </T>
            </View>
            {user?.workspace === 'employee' && <Ionicons name="chevron-forward" size={18} color={c.muted} />}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}>
          {groups.map((g) => {
            // The Workspace section has no heading or fold: its pages always show, first.
            const plain = g.title === 'Workspace';
            const shut = !plain && folded[g.title];
            return (
              <View key={g.title} style={{ marginTop: 16 }}>
                {!plain && (
                  <Pressable onPress={() => setFolded((f) => ({ ...f, [g.title]: !shut }))} accessibilityRole="button" accessibilityState={{ expanded: !shut }} style={styles.groupHead}>
                    <T size={12} weight="600" muted style={{ flex: 1 }}>
                      {g.title}
                    </T>
                    <Ionicons name={shut ? 'chevron-forward' : 'chevron-down'} size={16} color={c.muted} />
                  </Pressable>
                )}
                {!shut &&
                  g.items.map((i) => {
                    const on = path === i.to || path.startsWith(`${i.to}/`);
                    return (
                      <Pressable key={i.to} onPress={() => go(i.to)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.navRow, on ? [look.card(c, dark), { borderRadius: look.controlRadius }] : pressed && { backgroundColor: c.tint }]}>
                        {on ? (
                          <LinearGradient colors={[c.gradStart, c.gradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navTile}>
                            <Ionicons name={i.icon ?? 'ellipse-outline'} size={18} color={c.onAccent} />
                          </LinearGradient>
                        ) : (
                          <Ionicons name={i.icon ?? 'ellipse-outline'} size={20} color={c.muted} style={{ width: 32, textAlign: 'center' }} />
                        )}
                        <T size={13} weight="500" style={{ color: on ? c.text : c.muted }}>
                          {i.short?.toLowerCase().includes(i.label.toLowerCase()) ? i.short : i.label}
                        </T>
                      </Pressable>
                    );
                  })}
              </View>
            );
          })}

          {/* Settings: the theme and signing out (formerly the avatar's settings sheet). */}
          <View style={[styles.settings, { borderTopColor: c.line }]}>
            <T size={12} weight="600" muted style={{ paddingHorizontal: 4 }}>
              Theme
            </T>
            <Segmented<ThemePreference>
              label="Theme"
              value={preference}
              onChange={setPreference}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
            />
            <View style={{ marginTop: 8 }}>
              <Button
                label="Log out"
                icon="log-out-outline"
                variant="outline"
                onPress={() => {
                  onClose();
                  signOut();
                }}
              />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 50, borderRightWidth: 1, borderTopRightRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  fill: { borderTopRightRadius: 24, borderBottomRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  groupHead: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingHorizontal: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 8, borderRadius: 12, marginTop: 2 },
  navTile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  settings: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, gap: 8 },
});
