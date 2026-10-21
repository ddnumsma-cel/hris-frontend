import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * "Confirm it's you" before a phone clock-in, using the phone's own lock: fingerprint, face unlock / Face ID,
 * or its PIN / pattern / password. The phone does the check; the app only learns "confirmed" or not, so no
 * fingerprint or face data ever reaches MSMA. Temporary until the attendance machines are chosen.
 */
export type PhoneCheckMethod = 'PHONE_BIOMETRIC' | 'PHONE_PASSCODE';

export interface PhoneLock {
  /** The phone has a screen lock of any kind. */
  hasLock: boolean;
  /** Fingerprint or face unlock is set up on the phone. */
  biometric: boolean;
  /** What to call it on screen, e.g. "fingerprint", "Face ID". */
  biometricName: string;
}

export type PhoneCheckResult =
  | { ok: true; method: PhoneCheckMethod }
  /** message is null when the person cancelled (nothing to show). */
  | { ok: false; message: string | null };

export const NO_LOCK_MESSAGE =
  "This phone has no screen lock. Set a PIN, password, fingerprint or face unlock in the phone's " +
  'Settings (Security, or Face ID & Passcode), then try again.';

const CANCELLED = new Set(['user_cancel', 'system_cancel', 'app_cancel']);

export async function readPhoneLock(): Promise<PhoneLock> {
  const [level, types] = await Promise.all([
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const ios = Platform.OS === 'ios';
  const biometricName =
    face && !finger
      ? ios
        ? 'Face ID'
        : 'face unlock'
      : finger && !face
        ? ios
          ? 'Touch ID'
          : 'fingerprint'
        : 'fingerprint or face';
  return {
    hasLock: level !== LocalAuthentication.SecurityLevel.NONE,
    biometric: level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK,
    biometricName,
  };
}

/**
 * Asks the phone to confirm its owner. Tries fingerprint / face first; falls back to the phone's PIN or
 * password when the person asks for it, when the biometric is locked out, or when it is not available
 * (for example Face ID inside Expo Go).
 */
export async function confirmItsYou(
  verb: 'in' | 'out',
  lock: PhoneLock,
  usePasscode = false,
): Promise<PhoneCheckResult> {
  if (!lock.hasLock) return { ok: false, message: NO_LOCK_MESSAGE };
  const promptMessage = `Confirm it's you to clock ${verb}`;

  if (lock.biometric && !usePasscode) {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: true,
      fallbackLabel: 'Use phone PIN',
      cancelLabel: 'Cancel',
      biometricsSecurityLevel: 'weak',
    });
    if (r.success) return { ok: true, method: 'PHONE_BIOMETRIC' };
    if (CANCELLED.has(r.error)) return { ok: false, message: null };
    if (r.error === 'authentication_failed')
      return {
        ok: false,
        message: `Not recognised. Try again, or tap "Use my phone PIN or password instead".`,
      };
    // user_fallback, lockout, not_available, missing_usage_description: continue with the PIN / password.
  }

  const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
  if (r.success) return { ok: true, method: 'PHONE_PASSCODE' };
  if (CANCELLED.has(r.error)) return { ok: false, message: null };
  if (r.error === 'passcode_not_set' || r.error === 'not_enrolled')
    return { ok: false, message: NO_LOCK_MESSAGE };
  return { ok: false, message: "The phone could not confirm it's you. Please try again." };
}
