import {
  ConfirmationResult,
  getAuth,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
} from '@react-native-firebase/auth';

type PendingPhoneAuth = {
  phone: string;
  confirmation: ConfirmationResult;
};

let pending: PendingPhoneAuth | null = null;

export function toE164Phone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  return `+91${digits}`;
}

export function isValidIndianMobile(value: string) {
  return /^\d{10}$/.test(value.replace(/\D/g, ''));
}

export function getPendingPhoneAuth() {
  return pending;
}

export function clearPendingPhoneAuth() {
  pending = null;
}

export async function startPhoneSignIn(phoneE164: string) {
  const confirmation = await signInWithPhoneNumber(getAuth(), phoneE164);
  pending = { phone: phoneE164, confirmation };
  return confirmation;
}

export async function confirmPhoneCode(code: string) {
  if (!pending) {
    throw new Error('No pending phone verification. Request a new OTP.');
  }

  const credential = PhoneAuthProvider.credential(pending.confirmation.verificationId, code);
  const result = await signInWithCredential(getAuth(), credential);
  const idToken = await result.user.getIdToken(true);
  return { user: result.user, idToken, phone: pending.phone };
}

export async function resendPhoneCode() {
  if (!pending?.phone) {
    throw new Error('No phone number available to resend OTP.');
  }
  return startPhoneSignIn(pending.phone);
}
