import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKEND_DEMO_ACCOUNTS } from '@/lib/backend/auth';
import { Badge, Button, Card, font, T } from '~/components/ui';
import { API_URL, checkConnection } from '~/lib/api';
import { useTheme } from '~/lib/theme';
import { useSession } from '~/session';

export default function LoginScreen() {
  const { signIn } = useSession();
  const { c } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<{ ok: boolean; message: string } | null>(null);

  // The HR server's seeded logins.
  const demos = BACKEND_DEMO_ACCOUNTS;

  async function submit(u = username, p = password) {
    setBusy(true);
    setError(null);
    const message = await signIn(u.trim(), p);
    if (message) setError(message);
    setBusy(false);
  }

  async function testConnection() {
    setTesting(true);
    setConnection(await checkConnection());
    setTesting(false);
  }

  const input = [styles.input, font(), { borderColor: c.border, backgroundColor: c.fieldBg, color: c.text }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            {/* The MSMA mark (white and lime) on the website's dark slate tile. */}
            <View style={[styles.logo, { backgroundColor: c.sidebar }]}>
              <Image source={require('../../assets/msma-mark.png')} style={styles.mark} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <T size={20} weight="700">
                MSMA HRIS
              </T>
              <T muted size={14}>
                Employee app · Sample data
              </T>
            </View>
            <Badge label="Mobile UI" tone="accent" />
          </View>

          <Card>
            <T weight="600" size={17} style={{ marginBottom: 12 }}>
              Sign in
            </T>
            <T size={12} weight="500" style={{ marginBottom: 4 }}>
              Email
            </T>
            <TextInput style={input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" accessibilityLabel="Username" />
            <T size={12} weight="500" style={{ marginTop: 12, marginBottom: 4 }}>
              Password
            </T>
            <TextInput style={input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" accessibilityLabel="Password" onSubmitEditing={() => void submit()} />
            {error && (
              <T style={{ color: c.danger, marginTop: 12 }} size={14}>
                {error}
              </T>
            )}
            <View style={{ marginTop: 16 }}>
              <Button label="Sign in" onPress={() => void submit()} loading={busy} disabled={!username || !password} />
            </View>
          </Card>

          <Card>
            <T weight="600" size={14} style={{ marginBottom: 8 }}>
              Demo accounts
            </T>
            <View style={styles.demos}>
              {demos.map((d) => (
                <Pressable
                  key={d.username}
                  accessibilityRole="button"
                  accessibilityLabel={`Sign in as ${d.label}`}
                  onPress={() => {
                    setUsername(d.username);
                    setPassword(d.password);
                    void submit(d.username, d.password);
                  }}
                  style={({ pressed }) => [styles.demo, { borderColor: c.border, backgroundColor: pressed ? c.accentSoft : c.fieldBg }]}
                >
                  <T size={13} weight="500">
                    {d.label}
                  </T>
                  <T size={11} muted numberOfLines={1}>
                    {d.username}
                  </T>
                </Pressable>
              ))}
            </View>
          </Card>

            <View style={{ alignItems: 'center', gap: 4 }}>
              <T muted size={12}>
                Server: {API_URL}
              </T>
              <Pressable onPress={testConnection} accessibilityRole="button" disabled={testing} style={{ padding: 8 }}>
                <T size={14} weight="600" style={{ color: c.accent }}>
                  {testing ? 'Testing…' : 'Test connection'}
                </T>
              </Pressable>
              {connection && (
                <T size={13} style={{ textAlign: 'center', color: connection.ok ? c.success : c.danger }}>
                  {connection.message}
                </T>
              )}
            </View>
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
  demos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demo: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, minWidth: '47%', flexGrow: 1 },
});
