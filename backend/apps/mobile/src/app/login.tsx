import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, T } from '@/components/ui';
import { API_URL, checkConnection } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const { c } = useTheme();
  const [email, setEmail] = useState('employee@msma.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setConnection(await checkConnection());
    setTesting(false);
  }

  const input = [styles.input, { borderColor: c.border, backgroundColor: c.card, color: c.text }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: '#0E6B63' }]}>
            <T style={{ color: '#fff' }} size={20} weight="700">
              M
            </T>
          </View>
          <View>
            <T size={20} weight="700">
              MSMA HRIS
            </T>
            <T muted size={14}>
              Employee app · Sample data
            </T>
          </View>
        </View>

        <Card>
          <T weight="600" size={17} style={{ marginBottom: 12 }}>
            Sign in
          </T>
          <T size={14} weight="500" style={{ marginBottom: 6 }}>
            Email
          </T>
          <TextInput
            style={input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            accessibilityLabel="Email"
          />
          <T size={14} weight="500" style={{ marginTop: 14, marginBottom: 6 }}>
            Password
          </T>
          <TextInput
            style={input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            accessibilityLabel="Password"
            onSubmitEditing={submit}
            placeholder="Demo@2026"
            placeholderTextColor={c.muted}
          />
          {error && (
            <T style={{ color: c.danger, marginTop: 12 }} size={14}>
              {error}
            </T>
          )}
          <View style={{ marginTop: 18 }}>
            <Button
              label="Sign in"
              onPress={submit}
              loading={busy}
              disabled={!email || !password}
            />
          </View>
        </Card>
        <T muted size={12} style={{ textAlign: 'center' }}>
          Demo: employee@msma.test · Demo@2026{'\n'}Server: {API_URL}
        </T>
        <Pressable
          onPress={testConnection}
          accessibilityRole="button"
          disabled={testing}
          style={{ alignSelf: 'center', padding: 6 }}
        >
          <T size={14} weight="600" style={{ color: c.accent }}>
            {testing ? 'Testing…' : 'Test connection'}
          </T>
        </Pressable>
        {connection && (
          <T size={13} style={{ textAlign: 'center', color: connection.ok ? c.success : c.danger }}>
            {connection.message}
          </T>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 20, gap: 18 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
