// Building blocks shared by the shell: a bottom sheet (the phone's version of the website's floating panels),
// a segmented control (the website's SegmentedControl) and a tappable list row.

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '~/nav';
import { useTheme } from '~/lib/theme';
import { useReducedMotion } from '~/lib/useReducedMotion';
import { Badge, T } from './ui';

export function Sheet({ open, onClose, title, children, right, from = 'bottom' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; right?: ReactNode; from?: 'bottom' | 'top' | 'center' }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // The top variant drops down from under the status bar (notifications); it animates itself so it can slide back up.
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (from !== 'top') return;
    if (open) setShown(true);
    const done = () => !open && setShown(false);
    if (reduced) {
      v.setValue(open ? 1 : 0);
      done();
    } else Animated.timing(v, { toValue: open ? 1 : 0, duration: open ? 260 : 180, easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start(done);
  }, [open, from, reduced, v]);

  // A centred dialog that fades in over a dimmed screen.
  if (from === 'center') {
    return (
      <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
        <View style={styles.centerWrap}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Close" />
          <View accessibilityViewIsModal style={[styles.center, { backgroundColor: c.surfaceRaised, borderColor: c.border, shadowColor: c.text }]}>
            <View style={styles.sheetHead}>
              <T size={17} weight="600" style={{ flex: 1 }}>
                {title}
              </T>
              {right}
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
                <Ionicons name="close" size={22} color={c.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>{children}</ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  if (from === 'top') {
    return (
      <Modal visible={shown} transparent animationType="none" onRequestClose={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            styles.sheetTop,
            { backgroundColor: c.surfaceRaised, paddingTop: insets.top + 8, borderColor: c.border, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-600, 0] }) }] },
          ]}
        >
          <View style={styles.sheetHead}>
            <T size={17} weight="600" style={{ flex: 1 }}>
              {title}
            </T>
            {right}
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={22} color={c.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>{children}</ScrollView>
          <View style={[styles.grabber, { backgroundColor: c.border, marginTop: 12, marginBottom: 8 }]} />
        </Animated.View>
      </Modal>
    );
  }
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + 16, borderColor: c.border }]}>
        <View style={[styles.grabber, { backgroundColor: c.border }]} />
        <View style={styles.sheetHead}>
          <T size={17} weight="600" style={{ flex: 1 }}>
            {title}
          </T>
          {right}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
            <Ionicons name="close" size={22} color={c.muted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function Segmented<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.tint, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.fieldBg, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 }]}
          >
            <T size={13} weight={on ? '600' : '500'} style={{ color: on ? c.text : c.muted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ icon, label, hint, onPress, count, active, chevron = true }: { icon?: IconName; label: string; hint?: string; onPress: () => void; count?: number; active?: boolean; chevron?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Each link is a bordered tile with a round arrow button, so it reads as something to tap, not a plain list.
      style={({ pressed }) => [styles.row, { borderColor: active || pressed ? c.accent : c.border, backgroundColor: active || pressed ? c.accentSoft : c.fieldBg, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {icon && <Ionicons name={icon} size={20} color={active ? c.accent : c.muted} />}
      <View style={{ flex: 1 }}>
        <T size={14} weight="500" style={active ? { color: c.accent } : undefined}>
          {label}
        </T>
        {hint && (
          <T size={12} muted>
            {hint}
          </T>
        )}
      </View>
      {!!count && <Badge label={`${count > 99 ? '99+' : count} waiting`} tone="warning" />}
      {chevron && (
        <View style={[styles.go, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="chevron-forward" size={16} color={c.accent} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal, borderWidth: 1, borderBottomWidth: 0 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  center: { width: '100%', maxWidth: 440, maxHeight: '85%', borderRadius: radius.modal, borderWidth: 1, paddingTop: 4, shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  sheetTop: { position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: radius.modal, borderBottomRightRadius: radius.modal, borderTopWidth: 0, borderBottomWidth: 1 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.control, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.card, borderWidth: 1 },
  go: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
