import { LABELS, type ThemePreference } from '@msma/shared';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, SectionTitle, T } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useUpdatePreferences } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

const THEMES: {
  value: ThemePreference;
  icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline';
}[] = [
  { value: 'SYSTEM', icon: 'phone-portrait-outline' },
  { value: 'LIGHT', icon: 'sunny-outline' },
  { value: 'DARK', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { c, preference } = useTheme();
  const update = useUpdatePreferences();
  if (!user) return null;

  return (
    <Screen>
      <Card>
        <T size={20} weight="700">
          {user.displayName}
        </T>
        <T muted size={14} style={{ marginTop: 2 }}>
          {user.employeeNo} · {user.site?.name}
        </T>
        <T muted size={14}>
          {user.email} · {LABELS.role[user.role]}
        </T>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        {THEMES.map((t, i) => {
          const selected = preference === t.value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => update.mutate({ theme: t.value === 'SYSTEM' ? null : t.value })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.border,
              }}
            >
              <Ionicons name={t.icon} size={20} color={c.text} />
              <T style={{ flex: 1 }}>{LABELS.theme[t.value]}</T>
              {selected && <Ionicons name="checkmark" size={20} color={c.accent} />}
            </Pressable>
          );
        })}
      </Card>
      <T muted size={12}>
        Saved to your account. &quot;Match my device&quot; follows your phone&apos;s light or dark
        setting.
      </T>

      <SectionTitle>About</SectionTitle>
      <Card>
        <T muted size={13}>
          MSMA HRIS sample · synthetic data only
        </T>
        <View style={{ marginTop: 4 }}>
          <T muted size={13}>
            Server: {API_URL}
          </T>
        </View>
      </Card>

      <Button
        label="Sign out"
        variant="outline"
        icon="log-out-outline"
        onPress={() => void logout()}
      />
    </Screen>
  );
}
