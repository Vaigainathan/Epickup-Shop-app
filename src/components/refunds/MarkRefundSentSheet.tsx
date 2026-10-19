import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ConfirmBottomSheet } from '@/components/payment/ConfirmBottomSheet';
import { colors, spacing, typography } from '@/constants/theme';
import { formatInr, OrdersApiError, ordersErrorMessage } from '@/lib/orders-api';
import { submitRefundSent } from '@/lib/refunds-api';
import { isValidRefundUtr, normalizeRefundUtr } from '@/lib/utr-validation';

type Props = {
  visible: boolean;
  orderId: string;
  refundId: string;
  amount: number;
  customerUpiId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function MarkRefundSentSheet({
  visible,
  orderId,
  refundId,
  amount,
  customerUpiId,
  onClose,
  onSuccess,
}: Props) {
  const [utr, setUtr] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setUtr('');
    setStep('form');
    setError(null);
    setCopied(false);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  async function copyUpi() {
    if (!customerUpiId) return;
    await Clipboard.setStringAsync(customerUpiId);
    setCopied(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitRefundSent(orderId, refundId, {
        refundUtr: normalizeRefundUtr(utr),
        amount,
      });
      reset();
      onSuccess();
    } catch (err) {
      setError(ordersErrorMessage(err, 'Could not mark refund as sent.'));
      if (err instanceof OrdersApiError && err.code === 'FULL_UTR_REQUIRED') {
        setError('Enter the full 12-digit UTR from your UPI app.');
      }
    } finally {
      setBusy(false);
    }
  }

  const normalized = normalizeRefundUtr(utr);
  const utrOk = isValidRefundUtr(normalized);

  if (step === 'confirm') {
    return (
      <ConfirmBottomSheet
        visible={visible}
        title="Confirm refund sent"
        body={`Refund ${formatInr(amount)} to ${customerUpiId ?? 'customer UPI'} with UTR ${normalized}?`}
        primaryLabel={busy ? 'Saving…' : 'Confirm'}
        onPrimary={submit}
        onClose={() => setStep('form')}
        busy={busy}
      />
    );
  }

  return (
    <ConfirmBottomSheet
      visible={visible}
      title="Mark refund sent"
      body={`Send ${formatInr(amount)} in your UPI app, then enter the refund UTR below.`}
      primaryLabel="Continue"
      primaryDisabled={!utrOk}
      onPrimary={() => setStep('confirm')}
      onClose={handleClose}
      busy={busy}>
      {customerUpiId ? (
        <View style={styles.upiRow}>
          <Text style={styles.upiText} numberOfLines={1}>{customerUpiId}</Text>
          <Pressable accessibilityRole="button" onPress={copyUpi} style={styles.copyBtn}>
            <Text style={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.waiting}>Waiting for the customer to share their refund UPI ID.</Text>
      )}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amountValue}>{formatInr(amount)}</Text>
      </View>
      <TextInput
        value={utr}
        onChangeText={setUtr}
        placeholder="12-digit refund UTR"
        placeholderTextColor={colors.textPlaceholder}
        keyboardType="number-pad"
        maxLength={12}
        editable={!busy}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ConfirmBottomSheet>
  );
}

const styles = StyleSheet.create({
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
  },
  upiText: {
    flex: 1,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  copyBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  copyLabel: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
  waiting: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
  },
  amountValue: {
    fontFamily: typography.fonts.semibold,
    fontSize: typography.sizes.body,
    color: colors.heading,
  },
  input: {
    height: spacing.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.input,
    color: colors.heading,
    backgroundColor: colors.background,
  },
  error: {
    fontFamily: typography.fonts.regular,
    fontSize: typography.sizes.body,
    color: colors.error,
    textAlign: 'center',
  },
});
