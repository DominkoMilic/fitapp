import { useContext, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button, ChipGroup, Text, TextField } from '@/components/ui';
import { ModalShell } from '@/components/ui/ModalShell';
import { SOCIAL_ERRORS } from '@/domain/social';
import { envResult } from '@/config/env';
import { motion, radius, spacing, useTheme } from '@/theme';

import { errorCode, type ReportReason, useReport } from '../api';

const REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or fake' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate name or text' },
  { value: 'other', label: 'Something else' },
];

const supportEmail = envResult.ok ? envResult.env.supportEmail : undefined;

/** Report a profile (later: posts, comments, clubs). Reviewed within 24 hours (spec 33.7). */
export function ReportSheet({
  visible,
  targetType,
  targetId,
  targetName,
  onClose,
}: {
  visible: boolean;
  targetType: 'profile' | 'feed_item' | 'comment' | 'club';
  targetId: string;
  targetName: string;
  onClose: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  // Context (not the hook) so the sheet also renders without a provider (tests).
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const close = () => {
    report.reset();
    setReason(null);
    setNote('');
    onClose();
  };
  return (
    <ModalShell visible={visible} onRequestClose={close}>
      <View style={styles.fill}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.normal)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={close}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
          />
        </Animated.View>
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.normal)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: bottomInset + spacing.md,
            },
          ]}
        >
          {report.isSuccess ? (
            <>
              <Text variant="title" accessibilityRole="header">
                Thanks for reporting
              </Text>
              <Text variant="body" color="textSecondary" accessibilityLiveRegion="polite">
                We’ll review it within 24 hours.
                {supportEmail
                  ? ` If someone is in danger or you need more help, write to ${supportEmail}.`
                  : ''}
              </Text>
              <Button title="Done" onPress={close} />
            </>
          ) : (
            <>
              <Text variant="title" accessibilityRole="header">
                Report {targetName}
              </Text>
              <Text variant="small" color="textSecondary">
                They won’t know who reported them.
              </Text>
              <ChipGroup
                options={REASONS}
                selected={reason ? [reason] : []}
                onToggle={(v) => setReason(v)}
                accessibilityLabel="Reason"
                single
              />
              <TextField
                label="Details (optional)"
                value={note}
                onChangeText={setNote}
                maxLength={500}
                multiline
              />
              {report.isError ? (
                <Text variant="small" color="danger" accessibilityRole="alert">
                  {SOCIAL_ERRORS[errorCode(report.error)]}
                </Text>
              ) : null}
              <Button
                title="Send report"
                disabled={!reason}
                loading={report.isPending}
                onPress={() =>
                  reason && report.mutate({ targetType, targetId, reason, note: note.trim() })
                }
              />
              <Button title="Cancel" variant="ghost" onPress={close} />
            </>
          )}
        </Animated.View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
});
