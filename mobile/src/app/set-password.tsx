import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/backend/client';
import { Button, Card, font, T } from '~/components/ui';
import { useTheme } from '~/lib/theme';
import { useSession } from '~/session';

const MIN_LENGTH = 8;

/** First sign-in with a temporary password: they choose their own before the app opens (as on the website). */
export default function SetPasswordScreen() {
  const { user, passwordChanged, signOut } = useSession();
  const { c } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!current) return setError('Enter the temporary password you just signed in with.');
    if (next.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (next !== again) return setError("The two new passwords don't match.");
    if (next === current) return setError('Choose a password different from the temporary one.');
    setBusy(true);
    setError(null);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      passwordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your password. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, font(), { borderColor: c.border, backgroundColor: c.fieldBg, color: c.text }];
  const field = (label: string, value: string, set: (v: string) => void, textContentType: 'password' | 'newPassword', last = false) => (
    <>
      <T size={12} weight="500" style={{ marginTop: 12, marginBottom: 4 }}>
        {label}
      </T>
      <TextInput
        style={input}
        value={value}
        onChangeText={(v) => {
          set(v);
          setError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        textContentType={textContentType}
        accessibilityLabel={label}
        onSubmitEditing={last ? () => void save() : undefined}
      />
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: c.sidebar }]}>
              <Image source={require('../../assets/msma-mark.png')} style={styles.mark} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <T size={20} weight="700">
                MSMA HRIS
              </T>
              <T muted size={14}>
                Welcome, {user?.name}
              </T>
            </View>
          </View>

          <Card>
            <T weight="600" size={17}>
              Choose your password
            </T>
            <T muted size={14} style={{ marginTop: 4 }}>
              You signed in with a temporary password; set your own to continue.
            </T>
            {field('Temporary password', current, setCurrent, 'password')}
            {field(`New password (at least ${MIN_LENGTH} characters)`, next, setNext, 'newPassword')}
            {field('New password again', again, setAgain, 'newPassword', true)}
            {error && (
              <T style={{ color: c.danger, marginTop: 12 }} size={14}>
                {error}
              </T>
            )}
            <View style={{ marginTop: 16, gap: 8 }}>
              <Button label="Save and continue" onPress={() => void save()} loading={busy} disabled={!current || !next || !again} />
              <Button label="Sign out" variant="outline" onPress={signOut} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 44, height: 44, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 32, height: 32 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 16 },
});
