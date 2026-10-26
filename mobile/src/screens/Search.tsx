// The Search page (opened from the top bar's search icon): finds the pages and Start actions this person can open,
// the same lists as the menu and Start. The hint in the field cycles through their pages while it's empty; recent
// searches (per account, on this device) show until something is typed.

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useReducedMotion } from '~/lib/useReducedMotion';
import { Row } from '~/components/sheets';
import { font, T } from '~/components/ui';
import { go } from '~/lib/go';
import { useTheme } from '~/lib/theme';
import { navFor } from '~/nav';
import { useSession, useWho } from '~/session';
import { startFor } from '~/start';

const MAX_RECENT = 8;
const recentKey = (accountId: string) => `msma-hris-recent-searches:${accountId}`;

function readRecent(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // No storage: recent searches last for this visit only.
  }
}

export default function SearchScreen() {
  const { c } = useTheme();
  const { user } = useSession();
  const who = useWho();
  const reduced = useReducedMotion();
  const key = recentKey(user?.account.id ?? 'signed-out');
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => readRecent(key));
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const pages = user ? navFor(user.workspace, who).flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])])) : [];
  const actions = user ? startFor(user.workspace, who).flatMap((g) => g.items) : [];

  // "Search pages", then each of their pages in turn, every few seconds while the field is empty.
  const hints = ['pages', ...pages.filter((p, i) => i > 0 && pages.findIndex((o) => o.label === p.label) === i).map((p) => p.label.toLowerCase())];
  const [hint, setHint] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (q || hints.length < 2) return;
    const id = setInterval(() => {
      if (reduced) return setHint((h) => (h + 1) % hints.length);
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => {
        setHint((h) => (h + 1) % hints.length);
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
      });
    }, 3000);
    return () => clearInterval(id);
  }, [q, hints.length, reduced, fade]);

  const term = q.trim().toLowerCase();
  const hit = (...texts: (string | undefined)[]) => texts.some((t) => t?.toLowerCase().includes(term));
  const foundActions = term ? actions.filter((a) => hit(a.label, a.hint)) : [];
  const foundPages = term ? pages.filter((p, i) => hit(p.label) && pages.findIndex((o) => o.to === p.to) === i) : [];

  const saveRecent = (list: string[]) => {
    setRecent(list);
    writeRecent(key, list);
  };
  const remember = () => {
    const t = q.trim();
    if (t) saveRecent([t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT));
  };
  const pick = (to: string) => {
    remember();
    go(to);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.fieldBg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>
        {/* A tap anywhere on the box (icon, hint, padding) puts the cursor back in the field. */}
        <Pressable onPress={() => input.current?.focus()} accessible={false} style={[styles.field, { borderColor: focused ? c.accent : c.border, backgroundColor: c.fieldBg }]}>
          <Ionicons name="search-outline" size={18} color={c.muted} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {!q && (
              <Animated.Text
                numberOfLines={1}
                aria-hidden
                importantForAccessibility="no"
                style={[styles.hint, font(), { color: c.muted, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}
              >
                Search {hints[hint % hints.length]}
              </Animated.Text>
            )}
            <TextInput
              ref={input}
              value={q}
              onChangeText={setQ}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={remember}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search pages and actions"
              style={[styles.input, font(), { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            />
          </View>
          {!!q && (
            <Pressable
              onPress={() => {
                setQ('');
                input.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={c.muted} />
            </Pressable>
          )}
        </Pressable>

        {!term && recent.length > 0 && (
          <View style={{ gap: 4 }}>
            <View style={styles.head}>
              <T size={11} weight="600" muted style={styles.label}>
                RECENT SEARCHES
              </T>
              <Pressable onPress={() => saveRecent([])} accessibilityRole="button" hitSlop={8}>
                <T size={13} weight="600" style={{ color: c.accent }}>
                  Clear all
                </T>
              </Pressable>
            </View>
            {recent.map((r) => (
              <View key={r} style={styles.recent}>
                <Pressable
                  onPress={() => {
                    setQ(r);
                    input.current?.focus();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${r} again`}
                  style={({ pressed }) => [styles.recentText, { backgroundColor: pressed ? c.tint : 'transparent' }]}
                >
                  <Ionicons name="time-outline" size={18} color={c.muted} />
                  <T size={14} numberOfLines={1} style={{ flex: 1 }}>
                    {r}
                  </T>
                </Pressable>
                <Pressable onPress={() => saveRecent(recent.filter((x) => x !== r))} accessibilityRole="button" accessibilityLabel={`Remove ${r} from recent searches`} hitSlop={4} style={styles.remove}>
                  <Ionicons name="close" size={16} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {foundActions.length > 0 && (
          <T size={11} weight="600" muted style={styles.label}>
            ACTIONS
          </T>
        )}
        {foundActions.map((a) => (
          <Row key={a.to} label={a.label} hint={a.hint} icon="flash-outline" onPress={() => pick(a.to)} />
        ))}
        {foundPages.length > 0 && (
          <T size={11} weight="600" muted style={styles.label}>
            PAGES
          </T>
        )}
        {foundPages.map((p) => (
          <Row key={p.to} label={p.label} icon={p.icon ?? 'document-outline'} onPress={() => pick(p.to)} />
        ))}
        {!!term && !foundPages.length && !foundActions.length && (
          <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
            {`Nothing matches "${q.trim()}"`}
          </T>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 12, marginBottom: 8 },
  hint: { position: 'absolute', left: 0, right: 0, fontSize: 16, pointerEvents: 'none' },
  input: { fontSize: 16, height: 46, padding: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.control },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
