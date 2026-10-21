import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Screen, T } from '~/components/ui';
import { useTheme } from '~/lib/theme';

/** A page the mobile app doesn't have yet (it's coming in a later phase). */
export function Placeholder({ title }: { title: string }) {
  const { c } = useTheme();
  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
        <Ionicons name="construct-outline" size={32} color={c.accent} />
        <T size={17} weight="600">
          {title}
        </T>
        <T muted size={14} style={{ textAlign: 'center' }}>
          This page is on the website and is coming to the mobile app next.
        </T>
      </Card>
    </Screen>
  );
}

/** An address this role can't open (the website's NoAccess). */
export function NoAccess() {
  const { c } = useTheme();
  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
        <Ionicons name="lock-closed-outline" size={32} color={c.muted} />
        <T size={17} weight="600">
          You don&apos;t have access to this page
        </T>
        <T muted size={14} style={{ textAlign: 'center' }}>
          Ask your HR administrator if you need it.
        </T>
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Button label="Go to Home" variant="outline" onPress={() => router.replace('/')} />
        </View>
      </Card>
    </Screen>
  );
}
