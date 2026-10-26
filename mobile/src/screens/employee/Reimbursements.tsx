// Reimbursements (the website's /employee/reimbursements): claim a work expense with a receipt photo and follow it.
// Phone-only demo for now: the website's in-browser claims store and its checks (60-day window, ₱50,000 cap, no
// claiming the same receipt twice), kept on this phone, so approvers on the website don't see these yet.

import { addDays, formatDate, formatPHP, manilaToday } from '@msma/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native';
import { fileMyClaim, myClaims } from '@/lib/ess/api';
import { CATEGORIES, CLAIM_WINDOW_DAYS, claimType, type Category, type ClaimStatus } from '@/lib/reimbursements/store';
import { Chip, DayPicker, daysBetween, ReasonInput, SelectField } from '~/components/form';
import { Badge, Button, Card, ErrorText, Loading, Screen, SectionTitle, T, font, mono } from '~/components/ui';
import { useTheme } from '~/lib/theme';

const KEY = ['ess', 'claims'];
// The phone doesn't ask for the store; the website's claim rules need one, so phone claims say it wasn't given.
const NO_MERCHANT = '—';
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: string) => `${MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// Same words as the website's reimbursement pages.
const STATUS: Record<ClaimStatus, { label: string; tone: 'warning' | 'accent' | 'success' | 'danger' }> = {
  pending: { label: 'Waiting for approver', tone: 'warning' },
  endorsed: { label: 'Waiting for Accounting', tone: 'accent' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export default function ReimbursementsScreen() {
  const list = useQuery({ queryKey: KEY, queryFn: myClaims });
  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Button label="Submit reimbursement" icon="receipt-outline" onPress={() => router.push('/employee/reimbursements/new')} />
      <SectionTitle>My claims</SectionTitle>
      <ErrorText error={list.error} onRetry={() => void list.refetch()} />
      {list.isLoading && <Loading />}
      {list.data?.length === 0 && (
        <T muted size={14}>
          No claims yet.
        </T>
      )}
      {list.data?.map((cl) => (
        <Card key={cl.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="600">{claimType(cl)}</T>
              <T size={18} weight="600" style={mono}>
                {formatPHP(String(cl.amount))}
              </T>
            </View>
            <Badge label={cl.paidAt ? 'Paid' : STATUS[cl.status].label} tone={cl.paidAt ? 'success' : STATUS[cl.status].tone} />
          </View>
          <T size={14}>
            {cl.merchant && cl.merchant !== NO_MERCHANT ? `${cl.merchant} · ` : ''}
            {formatDate(cl.purchaseDate)}
          </T>
          <T size={12} muted>
            {cl.description}
          </T>
          {(cl.note || cl.approverNote) && (
            <T size={13} muted>
              Note: {cl.note ?? cl.approverNote}
            </T>
          )}
        </Card>
      ))}
    </Screen>
  );
}

/** Camera permission. Phones show their system prompt; the picker can't on the web, so ask the browser for the camera
 *  (its own "Allow camera?" prompt) and let it go straight away. */
async function askCamera() {
  if (Platform.OS !== 'web') return (await ImagePicker.requestCameraPermissionsAsync()).granted;
  if (!navigator.mediaDevices?.getUserMedia) return true; // No camera API (a desktop without one): the file picker still works.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (e) {
    // No camera at all isn't a refusal: fall back to picking a file.
    return (e as Error).name !== 'NotAllowedError';
  }
}

export function ReimbursementNewScreen() {
  const { c } = useTheme();
  const qc = useQueryClient();
  const today = manilaToday();
  const [category, setCategory] = useState<Category | ''>('');
  const [otherType, setOtherType] = useState('');
  const [date, setDate] = useState(today);
  // The claim window (last 60 days), picked by month first so nobody scrolls through every day.
  const windowDays = daysBetween(addDays(today, -CLAIM_WINDOW_DAYS), today);
  const months = [...new Set(windowDays.map((d) => d.slice(0, 7)))].reverse();
  const [month, setMonth] = useState(today.slice(0, 7));
  const pickMonth = (m: string) => {
    setMonth(m);
    if (!date.startsWith(m)) setDate(windowDays.filter((d) => d.startsWith(m)).at(-1)!);
  };
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState('');
  const [photoError, setPhotoError] = useState('');

  // shortcut: the photo is stored as picked (quality 0.5, not resized); add expo-image-manipulator if phones fill up.
  const pick = async (camera: boolean) => {
    setPhotoError('');
    // The phone (or browser) asks its own permission question the first time; nothing opens if it's refused.
    if (camera && !(await askCamera())) {
      setPhotoError('Allow camera access in Settings to take a photo of the receipt.');
      return;
    }
    if (!camera && !(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) {
      setPhotoError('Allow photo access in Settings to choose a receipt photo.');
      return;
    }
    // The back camera, for the receipt (on the web this asks mobile browsers to open the camera, not files).
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true, cameraType: ImagePicker.CameraType.back };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const photo = result.canceled ? undefined : result.assets[0];
    if (!photo) return;
    // The web picker already gives a data URL; phones give base64.
    setReceipt(photo.base64 ? `data:${photo.mimeType ?? 'image/jpeg'};base64,${photo.base64}` : photo.uri);
  };

  const send = useMutation({
    mutationFn: () =>
      fileMyClaim({ category, otherType: otherType.trim(), merchant: NO_MERCHANT, purchaseDate: date, amount: Number(amount), description: description.trim(), receipt }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      router.replace('/employee/reimbursements');
    },
  });

  const field = [styles.field, font(), { borderColor: c.border, backgroundColor: c.fieldBg, color: c.text }];
  const ready = category && Number(amount) > 0 && description.trim() && receipt && (category !== 'Other' || otherType.trim());

  return (
    <Screen>
      <SectionTitle>What was it for?</SectionTitle>
      <SelectField label="What was it for?" value={category} options={CATEGORIES} onChange={(v) => setCategory(v as Category)} />
      {category === 'Other' && (
        <TextInput value={otherType} onChangeText={setOtherType} placeholder="Kind of expense" placeholderTextColor={c.muted} maxLength={60} accessibilityLabel="Kind of expense" style={field} />
      )}

      <SectionTitle>Receipt</SectionTitle>
      {receipt ? <Image source={{ uri: receipt }} style={[styles.photo, { borderColor: c.border }]} resizeMode="cover" accessibilityLabel="Receipt photo" /> : null}
      <View style={styles.wrap}>
        <View style={{ flex: 1 }}>
          <Button label={receipt ? 'Retake' : 'Take photo'} icon="camera-outline" variant="outline" onPress={() => void pick(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Choose photo" icon="images-outline" variant="outline" onPress={() => void pick(false)} />
        </View>
      </View>
      {!!photoError && <T style={{ color: c.danger }}>{photoError}</T>}


      <SectionTitle>Date on the receipt</SectionTitle>
      <View style={styles.wrap}>
        {months.map((m) => (
          <Chip key={m} label={monthLabel(m)} selected={month === m} onPress={() => pickMonth(m)} />
        ))}
      </View>
      <DayPicker days={windowDays.filter((d) => d.startsWith(month))} value={date} onChange={setDate} today={today} />

      <SectionTitle>Total amount (₱)</SectionTitle>
      <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} placeholder="0.00" placeholderTextColor={c.muted} keyboardType="decimal-pad" accessibilityLabel="Total amount in pesos" style={field} />

      <SectionTitle>Details</SectionTitle>
      <ReasonInput value={description} onChange={setDescription} placeholder="e.g. Taxi to the BIR office for the client filing" />

      {send.error && (
        <Card style={{ borderColor: c.danger, backgroundColor: c.dangerSoft }}>
          <T style={{ color: c.danger }}>{send.error.message}</T>
        </Card>
      )}
      <Button label="Send to my manager" icon="send" onPress={() => send.mutate()} loading={send.isPending} disabled={!ready} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, fontSize: 16 },
  photo: { width: '100%', height: 200, borderRadius: 12, borderWidth: 1 },
});
