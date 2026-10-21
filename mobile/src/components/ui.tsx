import { Ionicons } from '@expo/vector-icons';
import { LABELS, radius, type RequestStatus } from '@msma/shared';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '~/lib/theme';

/** Lexend at the weight asked for (the website's font). Android needs one font file per weight. */
export function font(weight?: TextStyle['fontWeight']): TextStyle {
  const w = Number(weight === 'bold' ? 700 : weight === 'normal' || !weight ? 400 : weight);
  return {
    fontFamily:
      w >= 700 ? 'Lexend_700Bold' : w >= 600 ? 'Lexend_600SemiBold' : w >= 500 ? 'Lexend_500Medium' : w <= 300 ? 'Lexend_300Light' : 'Lexend_400Regular',
  };
}

/** Figures (times, money): Lexend with even-width digits, as on the website. */
export const mono: TextStyle = { fontVariant: ['tabular-nums'] };

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { c, look } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.screen, { gap: look.gap }]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  tone = 'card',
}: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'card' | 'accent';
}) {
  const { c, dark, look } = useTheme();
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' ? { backgroundColor: c.accentSoft, borderColor: c.accentSoft } : look.card(c, dark),
        { borderRadius: look.cardRadius },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function T({
  children,
  style,
  muted,
  size = 15,
  weight,
  numberOfLines,
}: {
  children: ReactNode;
  style?: TextStyle | TextStyle[];
  muted?: boolean;
  size?: number;
  weight?: TextStyle['fontWeight'];
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ color: muted ? c.muted : c.text, fontSize: size }, font(weight), style]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T size={16} weight="600">
        {children}
      </T>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}) {
  const { c, look } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { borderRadius: look.controlRadius },
        primary
          ? { shadowColor: c.gradEnd, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 }
          : { borderWidth: 1, borderColor: c.border, backgroundColor: c.fieldBg },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
      ]}
    >
      {primary && (
        <LinearGradient
          colors={[c.gradStart, c.gradEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: look.controlRadius }]}
        />
      )}
      {loading ? (
        <ActivityIndicator color={primary ? c.onAccent : c.accent} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={primary ? c.onAccent : c.text} />}
          <Text style={[{ color: primary ? c.onAccent : c.text, fontSize: 16 }, font('600')]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const { c } = useTheme();
  const map: Record<Tone, [string, string]> = {
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    accent: [c.accentSoft, c.accent],
    neutral: [c.tint, c.muted],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={[{ color: fg, fontSize: 11 }, font('500')]}>{label}</Text>
    </View>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const tone = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
  } as const;
  const icon = {
    PENDING: 'time-outline',
    APPROVED: 'checkmark',
    REJECTED: 'close',
    CANCELLED: 'remove',
  } as const;
  return <Badge label={LABELS.requestStatus[status]} tone={tone[status]} icon={icon[status]} />;
}

export function ErrorText({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  const { c } = useTheme();
  if (!error) return null;
  return (
    <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
      <T style={{ color: c.danger }} weight="600">
        Could not load
      </T>
      <T style={{ color: c.danger, marginTop: 4 }} size={14}>
        {error.message}
      </T>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: 8 }}>
          <T style={{ color: c.danger, textDecorationLine: 'underline' }} weight="600">
            Try again
          </T>
        </Pressable>
      )}
    </Card>
  );
}

export function Loading() {
  const { c } = useTheme();
  return <ActivityIndicator style={{ marginVertical: 24 }} color={c.accent} />;
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
