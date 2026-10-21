import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '@msma/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Loading, mono, Screen, T } from '@/components/ui';
import { confirmItsYou, NO_LOCK_MESSAGE, type PhoneLock, readPhoneLock } from '@/lib/phone-check';
import { useClock, useToday } from '@/lib/queries';
import { useTheme } from '@/lib/theme';

/**
 * Phone clock-in (temporary, until the attendance machines are chosen): the phone confirms it's the employee
 * with its fingerprint, face or PIN, then the punch is sent (POST /me/clock). Biometrics never leave the phone.
 */
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
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="checkmark-circle" size={64} color={c.success} />
          <T size={20} weight="700" style={{ marginTop: 12 }}>
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
      <View
        style={[styles.badge, { borderColor: c.accent, backgroundColor: c.accentSoft }]}
        accessible={false}
      >
        <Ionicons
          name={lock.biometric ? 'finger-print' : 'keypad-outline'}
          size={88}
          color={c.accent}
        />
      </View>
      <T size={18} weight="600" style={{ textAlign: 'center' }}>
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

      <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
        <T size={13}>
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
  badge: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
