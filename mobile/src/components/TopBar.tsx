// The phone's top bar: page title, then the website's top-bar controls: Start (the workspace's Start menu),
// the notifications bell with its unread count, and the settings/account menu.

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listMyNotifications, markMyNotificationsRead } from '@/lib/notifications';
import { timeAgo } from '@/lib/timeAgo';
import { fmtDay } from '@/lib/preferences';
import { useTheme } from '~/lib/theme';
import { useSession, useWho } from '~/session';
import { startFor } from '~/start';
import { Row, Segmented, Sheet } from './sheets';
import { go as goTo } from '~/lib/go';
import { Badge, font, T } from './ui';


function IconButton({ icon, label, onPress, badge }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; badge?: number }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => [styles.icon, { backgroundColor: pressed ? c.tint : 'transparent' }]}>
      <Ionicons name={icon} size={22} color={c.text} />
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.bg }]}>
          <Text style={[{ color: c.onDanger, fontSize: 10 }, font('600')]}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TopBar({ title, back, onProfile, profileOpen }: { title: string; back: boolean; onProfile: () => void; profileOpen: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [open, setOpen] = useState<'bell' | null>(null);
  const notes = useQuery({ queryKey: ['mobile', 'notifications', user?.account.id], queryFn: listMyNotifications });
  const unread = (notes.data ?? []).filter((n) => n.unread).length;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: 'transparent' }]}>
      {/* Top left: the profile picture, which opens the profile panel (pages, theme, log out). */}
      <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel="Profile and menu" accessibilityState={{ expanded: profileOpen }} {...(Platform.OS === 'web' ? { 'aria-controls': 'profile-panel', 'aria-expanded': profileOpen } : {})} style={[styles.avatar, { backgroundColor: c.gradEnd }]}>
        <Text style={[{ color: c.onAccent, fontSize: 13 }, font('600')]}>{user?.initials}</Text>
      </Pressable>
      {/* Deeper screens (forms, clock-in) get a small muted ‹ joined to the title; main pages need none. */}
      {back ? (
        <View style={styles.backTitle}>
          {/* Only the arrow goes back; the title is just a title. */}
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back" style={styles.backArrow}>
            <Ionicons name="chevron-back" size={18} color={c.muted} />
          </Pressable>
          <T size={18} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </T>
        </View>
      ) : (
        <T size={18} weight="600" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </T>
      )}
      <IconButton icon="notifications-outline" label="Notifications" onPress={() => setOpen('bell')} badge={unread} />

      <BellSheet open={open === 'bell'} onClose={() => setOpen(null)} />
    </View>
  );
}

function go(to: string, close: () => void) {
  close();
  goTo(to);
}

/** The Start menu (opened from the Start tile in the centre of the bottom bar). */
export function StartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  const who = useWho();
  const groups = user ? startFor(user.workspace, who) : [];
  const waiting = groups.flatMap((g) => g.items.filter((l) => l.waiting));
  return (
    <Sheet open={open} onClose={onClose} title="Start">
      {waiting.length > 0 && (
        <>
          <T size={11} weight="600" muted style={styles.label}>
            WAITING ON YOU
          </T>
          {waiting.map((l) => (
            <Row key={l.to} label={l.label} hint={l.hint} icon="hourglass-outline" onPress={() => go(l.to, onClose)} />
          ))}
        </>
      )}
      {groups.map((g) => {
        const items = g.items.filter((l) => !l.waiting);
        if (!items.length) return null;
        return (
          <View key={g.title} style={{ gap: 4 }}>
            <T size={11} weight="600" muted style={styles.label}>
              {g.title.toUpperCase()}
            </T>
            {items.map((l) => (
              <Row key={l.to} label={l.label} hint={l.hint} onPress={() => go(l.to, onClose)} />
            ))}
          </View>
        );
      })}
    </Sheet>
  );
}

function BellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ['mobile', 'notifications', user?.account.id], queryFn: listMyNotifications });
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const list = (notes.data ?? []).filter((n) => tab === 'all' || n.unread);
  const close = () => {
    onClose();
    void markMyNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ['mobile', 'notifications'] }));
  };
  return (
    <Sheet open={open} onClose={close} title="Notifications">
      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
        ]}
      />
      {list.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
        </T>
      )}
      {list.map((n) => (
        <Pressable key={n.id} onPress={() => (n.link ? go(n.link, close) : undefined)} accessibilityRole={n.link ? 'button' : undefined} style={[styles.note, { backgroundColor: n.unread ? c.accentSoft : 'transparent' }]}>
          {n.unread && <View style={[styles.dot, { backgroundColor: c.accent }]} />}
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} weight="600">
              {n.title}
            </T>
            <T size={13} muted numberOfLines={2}>
              {n.body}
            </T>
            <T size={11} muted>
              {timeAgo(n.at, fmtDay)}
            </T>
          </View>
          {n.link && <Badge label={n.kind === 'request' ? 'Review' : 'View'} tone={n.kind === 'request' ? 'accent' : 'neutral'} />}
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backArrow: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  label: { letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  note: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.control, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
