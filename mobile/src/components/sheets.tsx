// Building blocks shared by the shell: a bottom sheet (the phone's version of the website's floating panels),
// a segmented control (the website's SegmentedControl) and a tappable list row.

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '~/nav';
import { useTheme } from '~/lib/theme';
import { Badge, T } from './ui';

export function Sheet({ open, onClose, title, children, right }: { open: boolean; onClose: () => void; title: string; children: ReactNode; right?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
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
      style={({ pressed }) => [styles.row, { backgroundColor: active ? c.accentSoft : pressed ? c.tint : 'transparent' }]}
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
      {chevron && <Ionicons name="chevron-forward" size={18} color={c.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', borderRadius: radius.control, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control },
});
