// The phone's top bar: page title, then the website's top-bar controls: Start (the workspace's Start menu),
// the notifications bell with its unread count, and the settings/account menu.

import { Ionicons } from '@expo/vector-icons';
import { radius } from '@msma/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listMyNotifications, markMyNotificationsRead, type NotificationKind } from '@/lib/notifications';
import { timeAgo } from '@/lib/timeAgo';
import { fmtDay } from '@/lib/preferences';
import { useTheme } from '~/lib/theme';
import { useSession, useWho } from '~/session';
import { startFor } from '~/start';
import { Row, Sheet } from './sheets';
import { go as goTo } from '~/lib/go';
import { font, T } from './ui';


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
  const path = usePathname();
  const [open, setOpen] = useState<'bell' | null>(null);
  const notes = useQuery({ queryKey: ['mobile', 'notifications', user?.account.id], queryFn: listMyNotifications });
  const unread = (notes.data ?? []).filter((n) => n.unread).length;

  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: path === '/search' ? c.fieldBg : 'transparent' }]}>
      {/* Top left: the menu button, which opens the profile panel (pages, theme, log out). */}
      <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel="Profile and menu" accessibilityState={{ expanded: profileOpen }} {...(Platform.OS === 'web' ? { 'aria-controls': 'profile-panel', 'aria-expanded': profileOpen } : {})} hitSlop={4} style={({ pressed }) => [styles.icon, styles.menu, { backgroundColor: pressed || profileOpen ? c.tint : 'transparent' }]}>
        <Ionicons name="menu" size={24} color={c.text} />
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
      {path !== '/search' && <IconButton icon="search-outline" label="Search" onPress={() => router.push('/search')} />}
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
          <View key={g.title} style={{ gap: 8 }}>
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

type BellTone = 'success' | 'warning' | 'danger' | 'accent';

// A round icon per kind, like the website's NotificationsPanel.
const KIND: Record<NotificationKind, { icon: React.ComponentProps<typeof Ionicons>['name']; tone: BellTone }> = {
  request: { icon: 'time-outline', tone: 'warning' },
  approved: { icon: 'checkmark', tone: 'success' },
  rejected: { icon: 'close', tone: 'danger' },
  update: { icon: 'megaphone-outline', tone: 'accent' },
  seat: { icon: 'people-outline', tone: 'warning' },
  alert: { icon: 'alert-circle-outline', tone: 'warning' },
};

/** The bell's inbox: All / Unread tabs, "New" (unread when opened) and "Earlier", a Review or View button on rows that
 *  lead somewhere. Closing it marks everything read, like the website. */
function BellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { user } = useSession();
  const qc = useQueryClient();
  const notes = useQuery({ queryKey: ['mobile', 'notifications', user?.account.id], queryFn: listMyNotifications });
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  // What was unread when the panel opened stays under "New" until it closes, even after Mark all read.
  const [fresh, setFresh] = useState<string[] | null>(null);
  useEffect(() => {
    if (!open) setFresh(null);
    else if (notes.data && fresh === null) setFresh(notes.data.filter((n) => n.unread).map((n) => n.id));
  }, [open, notes.data, fresh]);
  const all = notes.data ?? [];
  const unread = all.filter((n) => n.unread).length;
  const list = all.filter((n) => tab === 'all' || n.unread);
  const groups = [
    { title: 'New', items: list.filter((n) => fresh?.includes(n.id)) },
    { title: 'Earlier', items: list.filter((n) => !fresh?.includes(n.id)) },
  ].filter((g) => g.items.length);
  const markRead = () => void markMyNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ['mobile', 'notifications'] }));
  const close = () => {
    onClose();
    markRead();
  };
  const tone = (t: BellTone) => ({ success: [c.successSoft, c.success], warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger], accent: [c.accentSoft, c.accent] })[t];

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Notifications"
      from="top"
      right={
        unread > 0 ? (
          <Pressable onPress={markRead} accessibilityRole="button" hitSlop={8}>
            <T size={13} weight="600" style={{ color: c.accent }}>
              Mark all read
            </T>
          </Pressable>
        ) : undefined
      }
    >
      {/* Underline tabs, the selected one with a line under it; Unread shows its count. */}
      <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: c.line }]}>
        {(['all', 'unread'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[styles.tab, tab === t && { borderBottomColor: c.text }]}>
            <T size={14} weight={tab === t ? '600' : '400'} muted={tab !== t}>
              {t === 'all' ? 'All' : 'Unread'}
            </T>
            {t === 'unread' && unread > 0 && (
              <View style={[styles.count, { backgroundColor: c.accent }]}>
                <Text style={[{ color: c.onAccent, fontSize: 10 }, font('600')]}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {list.length === 0 && (
        <T muted size={14} style={{ textAlign: 'center', paddingVertical: 24 }}>
          {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
        </T>
      )}
      {groups.map((g) => (
        <View key={g.title} style={{ gap: 4 }}>
          <T size={11} weight="600" muted style={styles.label}>
            {g.title.toUpperCase()}
          </T>
          {g.items.map((n) => {
            const k = KIND[n.kind ?? 'update'];
            const [bg, fg] = tone(k.tone);
            const review = n.kind === 'request';
            return (
              <Pressable
                key={n.id}
                onPress={() => (n.link ? go(n.link, close) : undefined)}
                accessibilityRole={n.link ? 'button' : undefined}
                style={({ pressed }) => [styles.note, { backgroundColor: n.unread ? c.accentSoft : pressed ? c.tint : 'transparent' }]}
              >
                <View style={[styles.kindIcon, { backgroundColor: bg }]}>
                  <Ionicons name={k.icon} size={18} color={fg} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={14} weight="600">
                    {n.title}
                  </T>
                  <T size={13} muted numberOfLines={2}>
                    {n.body}
                  </T>
                  <T size={11} muted style={{ marginTop: 2 }}>
                    {timeAgo(n.at, fmtDay)}
                  </T>
                </View>
                {n.link && (
                  <View style={[styles.action, review ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.border, backgroundColor: c.fieldBg }]}>
                    <T size={12} weight="600" style={review ? { color: c.onAccent } : undefined}>
                      {review ? 'Review' : 'View'}
                    </T>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
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
  menu: { marginLeft: -8, marginRight: 4 },
  label: { letterSpacing: 1, marginTop: 8, marginBottom: 4 },
  note: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.control, alignItems: 'flex-start' },
  tabs: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, marginBottom: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  count: { minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  kindIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  action: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 6 },
});
