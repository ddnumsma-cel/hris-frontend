import { Ionicons } from '@expo/vector-icons';
import { formatTime, radius } from '@msma/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Loading, mono, Screen, T } from '~/components/ui';
import { confirmItsYou, NO_LOCK_MESSAGE, type PhoneLock, readPhoneLock } from '~/lib/phone-check';
import { useClock, useToday } from '~/lib/queries';
import { useTheme } from '~/lib/theme';

/**
 * Phone clock-in (temporary, until the attendance machines are chosen): the phone confirms it's the employee
 * with its fingerprint, face or PIN, then the punch is sent (POST /me/clock). Biometrics never leave the phone.
 */
function Emblem({ icon, done }: { icon: React.ComponentProps<typeof Ionicons>['name']; done?: boolean }) {
  const { c } = useTheme();
  const ring = done ? c.successSoft : c.accentSoft;
  return (
    <View style={[styles.ringOuter, { backgroundColor: ring }]} accessible={false}>
      <View style={[styles.ringInner, { backgroundColor: ring }]}>
        {done ? (
          <View style={[styles.disc, { backgroundColor: c.success }]}>
            <Ionicons name={icon} size={40} color={c.onDanger} />
          </View>
        ) : (
          <LinearGradient colors={[c.gradStart, c.gradEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.disc}>
            <Ionicons name={icon} size={40} color={c.onAccent} />
          </LinearGradient>
        )}
      </View>
    </View>
  );
}

export default function ClockScreen() {
  const { c } = useTheme();
  const today = useToday();
  const clock = useClock();
  const [lock, setLock] = useState<PhoneLock | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const done = clock.data;
  const action = done?.action ?? today.data?.nextAction ?? 'CLOCK_IN';
  const verb = action === 'CLOCK_IN' ? 'in' : 'out';

  useEffect(() => {
    readPhoneLock()
      .then(setLock)
      .catch(() => setLock({ hasLock: false, biometric: false, biometricName: '' }));
  }, []);

  async function start(usePasscode: boolean) {
    if (!lock) return;
    setMessage(null);
    clock.reset();
    setChecking(true);
    try {
      const result = await confirmItsYou(verb, lock, usePasscode);
      if (result.ok) clock.mutate(result.method);
      else setMessage(result.message);
    } finally {
      setChecking(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Card style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: c.dashCard, borderColor: c.dashHairline }}>
          <Emblem icon="checkmark" done />
          <T size={20} weight="600" style={{ marginTop: 16 }}>
            Clocked {verb} at <T style={mono}>{formatTime(done.punchedAt)}</T>
          </T>
          {done.action === 'CLOCK_IN' && done.today.lateMinutes > 0 && (
            <T style={{ color: c.warning, marginTop: 6 }}>Late by {done.today.lateMinutes} min</T>
          )}
          <T muted size={14} style={{ marginTop: 6, textAlign: 'center' }}>
            HR can already see this on the dashboard.
          </T>
        </Card>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!lock) return <Loading />;

  const error = message ?? clock.error?.message ?? null;
  const busy = checking || clock.isPending;

  return (
    <Screen>
      <View style={[styles.panel, { backgroundColor: c.dashCard, borderColor: c.dashHairline }]}>
      <Emblem icon={lock.biometric ? 'finger-print' : 'keypad-outline'} />
      <T size={18} weight="600" style={{ textAlign: 'center', marginTop: 16 }}>
        Confirm it&apos;s you to clock {verb}
        {today.data ? ` at ${today.data.siteName}` : ''}
      </T>
      <T muted size={14} style={{ textAlign: 'center' }}>
        {lock.biometric
          ? `Your phone will ask for your ${lock.biometricName}, the same way you unlock it.`
          : lock.hasLock
            ? 'Your phone will ask for its PIN or password, the same way you unlock it.'
            : NO_LOCK_MESSAGE}
      </T>
      </View>

      {error && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{error}</T>
        </Card>
      )}

      <Button
        label={
          lock.biometric
            ? `Clock ${verb} with ${lock.biometricName}`
            : `Clock ${verb} with phone PIN`
        }
        icon={lock.biometric ? 'finger-print' : 'keypad-outline'}
        onPress={() => void start(false)}
        loading={busy}
        disabled={!lock.hasLock}
      />
      {lock.biometric && (
        <Button
          label="Use my phone PIN or password instead"
          variant="outline"
          onPress={() => void start(true)}
          disabled={busy}
        />
      )}
      <Button label="Cancel" variant="outline" onPress={() => router.back()} />

      <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft, flexDirection: 'row', gap: 8 }}>
        <Ionicons name="shield-checkmark-outline" size={18} color={c.accent} />
        <T size={13} style={{ flex: 1 }}>
          <T size={13} weight="600">
            Your fingerprint and face stay on this phone.{' '}
          </T>
          MSMA only receives &quot;confirmed&quot; and the time. Clocking in from the phone is
          temporary, for testing, until the office attendance machines are set up.
        </T>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.card, paddingVertical: 24, paddingHorizontal: 16 },
  ringOuter: { width: 144, height: 144, borderRadius: 72, alignItems: 'center', justifyContent: 'center', opacity: 1 },
  ringInner: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
});
