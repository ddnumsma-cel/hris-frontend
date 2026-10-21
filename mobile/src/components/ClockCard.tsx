// Today's clock-in on the employee Home, kept small: a round fingerprint button, today's time in / time out on
// one line, and the status. Tapping it opens the clock-in screen (the phone confirms it's the employee).

import { Ionicons } from '@expo/vector-icons';
import { formatTime, radius, type MeToday } from '@msma/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '~/lib/theme';
import { Badge, mono, T } from './ui';

const STATUS: Record<MeToday['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'accent' }> = {
  NOT_CLOCKED_IN: { label: 'Not clocked in', tone: 'warning' },
  CLOCKED_IN: { label: 'On shift', tone: 'success' },
  CLOCKED_OUT: { label: 'Clocked out', tone: 'neutral' },
  ON_LEAVE: { label: 'On leave', tone: 'accent' },
  REST_DAY: { label: 'Rest day', tone: 'neutral' },
  HOLIDAY: { label: 'Holiday', tone: 'neutral' },
};

export function ClockCard({ today: t }: { today: MeToday }) {
  const { c, dark, look } = useTheme();
  const status = STATUS[t.status];
  const label = t.nextAction === 'CLOCK_IN' ? 'Clock in' : 'Clock out';
  const late = t.lateMinutes > 0;
  return (
    <Pressable
      onPress={() => router.push('/employee/clock')}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Time in ${formatTime(t.timeIn)}, time out ${formatTime(t.timeOut)}. ${status.label}. Your phone confirms it's you with its fingerprint, face or PIN.`}
      style={({ pressed }) => [styles.row, look.card(c, dark), { borderRadius: look.cardRadius }, pressed && { backgroundColor: c.tint }]}
    >
      <LinearGradient colors={[c.gradStart, c.gradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
        <Ionicons name="finger-print" size={24} color={c.onAccent} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <T size={14} weight="600">
          {label}
        </T>
        <T size={12} muted style={mono} numberOfLines={1}>
          In <T size={12} weight="600" style={[mono, { color: late ? c.warning : c.text }]}>{formatTime(t.timeIn)}</T>
          {'  ·  '}Out <T size={12} weight="600" style={mono}>{formatTime(t.timeOut)}</T>
        </T>
        {late && (
          <T size={12} weight='500' style={{ color: c.warning }}>
            Late by {t.lateMinutes} min
          </T>
        )}
      </View>
      <Badge label={status.label} tone={status.tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.card, padding: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
