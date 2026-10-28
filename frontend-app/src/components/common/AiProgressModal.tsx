import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/src/theme/colors';

interface AiProgressModalProps {
  visible: boolean;
  title: string;
  steps: string[];
  activeStep: number;
  accessibilityLabel?: string;
}

const STEP_PROGRESS = [18, 55, 88];

export function AiProgressModal({
  visible,
  title,
  steps,
  activeStep,
  accessibilityLabel = 'AI 작업을 진행하고 있어요',
}: AiProgressModalProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const numericStep = Number.isFinite(activeStep) ? Math.floor(activeStep) : 0;
  const safeStep = Math.max(0, Math.min(numericStep, Math.max(steps.length - 1, 0)));
  const targetProgress = steps.length <= 1
    ? 88
    : STEP_PROGRESS[Math.min(safeStep, STEP_PROGRESS.length - 1)]
      ?? Math.round(((safeStep + 1) / steps.length) * 88);

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: targetProgress,
      duration: 360,
      useNativeDriver: false,
    }).start();
    return () => progress.stopAnimation();
  }, [progress, targetProgress, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay} accessibilityViewIsModal>
        <View
          style={styles.card}
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="progressbar"
          accessibilityState={{ busy: true }}
        >
          <Text style={styles.eyebrow}>AI 작업 진행 중</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>잠시만 기다려주세요. 결과를 준비하고 있어요.</Text>

          <View
            style={styles.progressTrack}
            accessibilityValue={{ min: 0, max: 100, now: targetProgress }}
          >
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <View style={styles.stepList}>
            {steps.map((step, index) => {
              const completed = index < safeStep;
              const active = index === safeStep;
              return (
                <View key={`${step}-${index}`} style={styles.stepRow}>
                  <View style={[styles.stepMark, completed && styles.stepMarkComplete, active && styles.stepMarkActive]}>
                    <Text style={[styles.stepMarkText, (completed || active) && styles.stepMarkTextActive]}>
                      {completed ? '✓' : index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stepText, active && styles.stepTextActive]}>{step}</Text>
                  {active ? <Text style={styles.stepStatus}>진행 중</Text> : null}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    padding: spacing.lg,
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brand,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 10,
    marginTop: 6,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  stepList: {
    gap: 10,
    marginTop: 6,
  },
  stepRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepMark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  stepMarkComplete: {
    backgroundColor: colors.successSoft,
  },
  stepMarkActive: {
    backgroundColor: colors.brand,
  },
  stepMarkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  stepMarkTextActive: {
    color: '#fff',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  stepTextActive: {
    fontWeight: '800',
    color: colors.text,
  },
  stepStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
});
