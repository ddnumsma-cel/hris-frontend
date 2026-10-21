import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { type ColorValue, Pressable, Text, View } from 'react-native';
import { useAuth } from '~/lib/auth';
import { useTheme } from '~/lib/theme';
import { font } from '~/components/ui';

function ProfileButton() {
  const { user } = useAuth();
  const { c } = useTheme();
  const initials = (user?.displayName ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My profile and settings"
        style={{ marginRight: 16 }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: c.gradEnd,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[{ color: c.onAccent, fontSize: 13 }, font('600')]}>{initials}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const icon =
    (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Ionicons name={name} color={color as string} size={size} />
    );
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: font('600'),
        headerShadowVisible: false,
        headerRight: () => <ProfileButton />,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surfaceRaised, borderTopColor: c.line, height: 64 },
        tabBarActiveBackgroundColor: c.accentSoft,
        tabBarLabelStyle: [{ fontSize: 12, lineHeight: 16 }, font('500')],
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerTitle: 'MSMA HRIS', tabBarIcon: icon('home-outline') }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', tabBarIcon: icon('time-outline') }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarIcon: icon('checkbox-outline') }}
      />
      <Tabs.Screen
        name="payslips"
        options={{ title: 'Payslips', tabBarIcon: icon('receipt-outline') }}
      />
    </Tabs>
  );
}
