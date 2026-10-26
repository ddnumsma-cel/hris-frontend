// My details (from the menu's name card). Name, ID, work email and branch come from the HR server and only HR changes
// them. The employee edits the same contact details as the website's "Update my contact details" dialog
// (EditProfileDialog): saved on this phone for now (the server doesn't let employees change their record yet).

import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { EMERGENCY_RELATIONSHIPS } from '@/lib/corehr/types';
import places from '@/lib/ph-places.json';
import { SelectField } from '~/components/form';
import { Button, Card, Screen, SectionTitle, T, font } from '~/components/ui';
import { useToday } from '~/lib/queries';
import { useTheme } from '~/lib/theme';
import { useSession } from '~/session';

interface Contact {
  mobile: string;
  personalEmail: string;
  address: string;
  city: string;
  province: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
}

const EMPTY: Contact = { mobile: '', personalEmail: '', address: '', city: '', province: '', emergencyName: '', emergencyRelationship: '', emergencyPhone: '' };
const PLACES = places as Record<string, string[]>;
const PROVINCES = Object.keys(PLACES);
/** A saved name that isn't in the list (e.g. typed before the dropdowns) stays selectable. */
const withSaved = (list: string[], v: string) => (v && !list.includes(v) ? [v, ...list] : list);
const keyFor = (accountId: string) => `msma-hris-my-contact:${accountId}`;

function readContact(key: string): Contact {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

// The website's rules: a PH mobile (0917 123 4567 or +63 917 123 4567) and a valid email.
const badPhone = (s: string) => !/^09\d{9}$/.test(s.replace(/\D/g, '').replace(/^63/, '0'));
const badEmail = (s: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function problems(c: Contact) {
  const p: Partial<Record<keyof Contact, string>> = {};
  // Required fields are the website's: mobile and the whole emergency contact.
  if (!c.mobile.trim()) p.mobile = 'Mobile number is required';
  else if (badPhone(c.mobile)) p.mobile = 'Use an 11-digit PH mobile number, e.g. 0917 123 4567';
  if (c.personalEmail.trim() && badEmail(c.personalEmail)) p.personalEmail = 'Enter a valid email';
  if (!c.emergencyName.trim()) p.emergencyName = 'Emergency contact person is required';
  if (!c.emergencyRelationship) p.emergencyRelationship = 'Relationship is required';
  if (!c.emergencyPhone.trim()) p.emergencyPhone = 'Emergency contact number is required';
  else if (badPhone(c.emergencyPhone)) p.emergencyPhone = 'Use an 11-digit PH mobile number, e.g. 0917 123 4567';
  return p;
}

export default function MyDetailsScreen() {
  const { c } = useTheme();
  const { user } = useSession();
  const today = useToday();
  const key = keyFor(user?.account.id ?? 'signed-out');
  const [saved, setSaved] = useState<Contact>(() => readContact(key));
  const [draft, setDraft] = useState<Contact | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  // Errors show after the first Save, so an empty form doesn't start out red.
  const errors = draft && tried ? problems(draft) : {};

  const save = () => {
    if (!draft) return;
    setTried(true);
    if (Object.keys(problems(draft)).length) return;
    const next = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as unknown as Contact;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError("Couldn't save on this phone. Try again.");
      return;
    }
    setSaved(next);
    setDraft(null);
    setError('');
  };

  const rows = (list: [string, string][]) => (
    <Card style={{ paddingVertical: 4 }}>
      {list.map(([label, value], i) => (
        <View key={label} style={[styles.row, { borderTopWidth: i ? 1 : 0, borderTopColor: c.border }]}>
          <T muted size={14}>
            {label}
          </T>
          <T weight="500" style={{ flexShrink: 1, textAlign: 'right' }}>
            {value || '—'}
          </T>
        </View>
      ))}
    </Card>
  );

  const label = (text: string, required: boolean) => (
    <T size={12} weight="500">
      {text}
      {required && <T size={12} style={{ color: c.danger }}> *</T>}
    </T>
  );

  const field = (text: string, k: keyof Contact, required: boolean, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={{ gap: 8 }}>
      {label(text, required)}
      <TextInput
        value={draft![k]}
        onChangeText={(v) => setDraft({ ...draft!, [k]: v })}
        accessibilityLabel={text}
        aria-invalid={!!errors[k]}
        placeholderTextColor={c.muted}
        style={[styles.input, font(), { borderColor: errors[k] ? c.danger : c.border, backgroundColor: c.fieldBg, color: c.text }]}
        {...props}
      />
      {errors[k] && (
        <T size={12} style={{ color: c.danger }}>
          {errors[k]}
        </T>
      )}
    </View>
  );

  return (
    <Screen>
      <SectionTitle>From HR</SectionTitle>
      {rows([
        ['Name', user?.name ?? ''],
        ['Employee ID', user?.account.employeeId ?? ''],
        ['Work email', user?.account.username ?? ''],
        ['Branch', today.data?.siteName ?? '…'],
      ])}

      <SectionTitle>{draft ? 'Update my contact details' : 'Contact details'}</SectionTitle>
      {draft ? (
        <Card style={{ gap: 20 }}>
          <T size={14} muted>
            Keep how HR can reach you up to date. Your name, ID numbers and job details can only be changed by HR.
          </T>
          {field('Mobile number', 'mobile', true, { placeholder: '+63 9XX XXX XXXX', keyboardType: 'phone-pad' })}
          {field('Personal email', 'personalEmail', false, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
          {field('Home address', 'address', false, { placeholder: 'House no., street, barangay' })}
          {/* Province first, then its cities and municipalities, like the website's PlaceFields. */}
          <View style={{ gap: 8 }}>
            {label('Province', false)}
            <SelectField label="Province" value={draft.province} options={withSaved(PROVINCES, draft.province)} onChange={(v) => setDraft({ ...draft, province: v, city: v === draft.province ? draft.city : '' })} />
          </View>
          <View style={{ gap: 8 }}>
            {label('City / municipality', false)}
            <SelectField
              label="City / municipality"
              value={draft.city}
              options={withSaved(PLACES[draft.province] ?? [], draft.city)}
              onChange={(v) => setDraft({ ...draft, city: v })}
              placeholder={draft.province ? 'Select an option' : 'Select a province first'}
              disabled={!draft.province}
            />
          </View>
          <T weight="600" size={14} style={{ marginTop: 12, marginBottom: -4 }}>
            Emergency contact
          </T>
          {field('Emergency contact person', 'emergencyName', true)}
          <View style={{ gap: 8 }}>
            {label('Relationship', true)}
            <SelectField label="Relationship" value={draft.emergencyRelationship} options={EMERGENCY_RELATIONSHIPS} onChange={(v) => setDraft({ ...draft, emergencyRelationship: v })} invalid={!!errors.emergencyRelationship} />
            {errors.emergencyRelationship && (
              <T size={12} style={{ color: c.danger }}>
                {errors.emergencyRelationship}
              </T>
            )}
          </View>
          {field('Emergency contact number', 'emergencyPhone', true, { placeholder: '+63 9XX XXX XXXX', keyboardType: 'phone-pad' })}
          {!!error && <T style={{ color: c.danger }}>{error}</T>}
          <View style={{ gap: 12, marginTop: 8 }}>
            <Button label="Save changes" icon="checkmark" onPress={save} />
            <Button label="Cancel" variant="outline" onPress={() => setDraft(null)} />
          </View>
        </Card>
      ) : (
        <>
          {rows([
            ['Mobile number', saved.mobile],
            ['Personal email', saved.personalEmail],
            ['Home address', saved.address],
            ['City / municipality', saved.city],
            ['Province', saved.province],
            ['Emergency contact', [saved.emergencyName, saved.emergencyRelationship && `(${saved.emergencyRelationship})`].filter(Boolean).join(' ')],
            ['Emergency contact number', saved.emergencyPhone],
          ])}
          <Button
            label="Update my contact details"
            icon="create-outline"
            variant="outline"
            onPress={() => {
              setTried(false);
              setDraft(saved);
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
});
