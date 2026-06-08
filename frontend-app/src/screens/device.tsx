import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { colors, radius, spacing } from '@/src/theme/colors';
import { DeviceSimulationStep, DynamicQrSession } from '@/src/types/app';
import {
  createPseudoQrMatrix,
  getEffectiveQrStatus,
  getQrPurposeLabel,
  getQrStatusLabel,
  getRemainingSeconds,
} from '@/src/utils/dynamicQr';

const deviceStepOrder: DeviceSimulationStep[] = [
  'qr_scanned',
  'server_validating',
  'locker_open',
  'awaiting_item',
  'item_detected',
  'server_updating',
  'completed',
];

const deviceStepLabels: Record<DeviceSimulationStep, string> = {
  idle: '대기',
  qr_scanned: 'QR 인식',
  server_validating: '서버 검증',
  locker_open: '잠금 해제',
  awaiting_item: '물품 대기',
  item_detected: '물품 감지',
  server_updating: '데이터 반영',
  completed: '완료',
  error: '오류',
};

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
}

function statusTone(status: ReturnType<typeof getEffectiveQrStatus>) {
  if (status === 'active') {
    return {
      backgroundColor: colors.brandSoft,
      color: colors.brand,
    };
  }

  if (status === 'used') {
    return {
      backgroundColor: colors.surfaceMuted,
      color: colors.textMuted,
    };
  }

  return {
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  };
}

function simulationTone(step: DeviceSimulationStep) {
  if (step === 'completed') {
    return colors.success;
  }

  if (step === 'error') {
    return colors.danger;
  }

  if (step === 'awaiting_item' || step === 'locker_open') {
    return colors.accent;
  }

  return colors.brand;
}

function DynamicQrMatrix({ value }: { value: string }) {
  const matrix = useMemo(() => createPseudoQrMatrix(value, 25), [value]);

  return (
    <View style={styles.qrCardFrame}>
      <View style={styles.qrMatrix}>
        {matrix.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.qrRow}>
            {row.map((cell, cellIndex) => (
              <View
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[styles.qrCell, cell ? styles.qrCellOn : styles.qrCellOff]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function DynamicQrStatusCard({
  session,
  now,
}: {
  session: DynamicQrSession;
  now: number;
}) {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((new Date(session.expiresAt).getTime() - now) / 1000),
  );
  const status = getEffectiveQrStatus(session);
  const tone = statusTone(status);
  const progress = session.ttlSeconds > 0 ? remainingSeconds / session.ttlSeconds : 0;

  return (
    <View style={styles.qrPanel}>
      <View style={styles.qrPanelTop}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.qrPanelTitle}>1회용 동적 QR</Text>
          <Text style={styles.qrPanelSubtitle}>
            {getQrPurposeLabel(session.purpose)} 전용 QR이며 시간 만료 후 자동으로 사용할 수 없게 됩니다.
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor }]}>
          <Text style={[styles.statusBadgeText, { color: tone.color }]}>{getQrStatusLabel(status)}</Text>
        </View>
      </View>

      <DynamicQrMatrix value={session.token} />

      <View style={styles.codeInfoCard}>
        <Text style={styles.codeInfoLabel}>인증 코드</Text>
        <Text style={styles.codeInfoValue}>{session.displayCode}</Text>
        <Text style={styles.codeInfoHint}>기부함 앞에서 QR을 인식하면 서버 검증 후 잠금이 해제됩니다.</Text>
      </View>

      <View style={styles.timerCard}>
        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>남은 시간</Text>
          <Text style={[styles.timerValue, status !== 'active' && { color: tone.color }]}>
            {status === 'active' ? formatTimer(remainingSeconds) : getQrStatusLabel(status)}
          </Text>
        </View>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${Math.max(0, progress) * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

function DeviceStepCard({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <View style={[styles.stepCard, active && styles.stepCardActive, done && styles.stepCardDone]}>
      <View
        style={[
          styles.stepDot,
          active && styles.stepDotActive,
          done && styles.stepDotDone,
        ]}
      />
      <Text
        style={[
          styles.stepLabel,
          active && styles.stepLabelActive,
          done && styles.stepLabelDone,
        ]}>
        {label}
      </Text>
    </View>
  );
}

export function DynamicQrScreen() {
  return <DeviceSimulatorScreen />;
}

export function DeviceSimulatorScreen() {
  const {
    user,
    activeQrSession,
    deviceSimulation,
    issueDynamicQr,
    startDeviceAuthentication,
    confirmDeviceItemInserted,
    resetDeviceSimulation,
  } = useAppContext();
  const [now, setNow] = useState(() => Date.now());
  const [tokenInput, setTokenInput] = useState('');
  const [working, setWorking] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const activeStatus = getEffectiveQrStatus(activeQrSession);
  const activeStepIndex = deviceStepOrder.indexOf(deviceSimulation.step);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    if (!user || activeQrSession) {
      return;
    }

    void (async () => {
      const result = await issueDynamicQr('donation_access', 30);
      if (active && result.error) {
        Alert.alert('QR 발급 실패', result.error);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeQrSession, issueDynamicQr, user]);

  const handleStartWithToken = async (token: string) => {
    setWorking(true);
    const result = await startDeviceAuthentication(token);
    setWorking(false);

    if (result.error) {
      Alert.alert('디바이스 인증 실패', result.error);
    }
  };

  const handleItemDetected = async () => {
    setWorking(true);
    const result = await confirmDeviceItemInserted();
    setWorking(false);

    if (result.error) {
      Alert.alert('물품 감지 실패', result.error);
    }
  };

  const handleIssueAndApply = async () => {
    setIssuing(true);
    const issueResult = await issueDynamicQr('donation_access', 30);
    setIssuing(false);

    if (issueResult.error) {
      Alert.alert('QR 발급 실패', issueResult.error);
      return;
    }

    Alert.alert('새 QR 발급 완료', '동적 QR이 새로 발급되었습니다. 현재 활성 QR로 바로 테스트할 수 있습니다.');
  };

  return (
    <AppScreen>
      <AppHeader title="기부함 디바이스 시뮬레이터" />

      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="hardware-chip-outline"
              size={28}
              color={simulationTone(deviceSimulation.step)}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.heroTitle}>QR 인증부터 완료 처리까지 테스트</Text>
            <Text style={styles.heroText}>
              30초 만료 QR 발급부터 QR 인식, 서버 검증, 잠금 해제, 물품 투입, 데이터 갱신까지 한 화면에서 검증할 수 있습니다.
            </Text>
          </View>
        </View>

        {activeQrSession ? <DynamicQrStatusCard session={activeQrSession} now={now} /> : null}

        <View style={styles.simulatorCard}>
          <View style={styles.simulatorTop}>
            <Text style={styles.sectionTitle}>활성 QR 상태</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusTone(activeStatus).backgroundColor },
              ]}>
              <Text style={[styles.statusBadgeText, { color: statusTone(activeStatus).color }]}>
                {getQrStatusLabel(activeStatus)}
              </Text>
            </View>
          </View>

          <Text style={styles.simulatorCode}>
            {activeQrSession?.displayCode ?? '발급된 QR이 없습니다'}
          </Text>
          <Text style={styles.supportText}>
            {activeQrSession
              ? `남은 시간 ${formatTimer(getRemainingSeconds(activeQrSession.expiresAt))}`
              : '먼저 동적 QR을 발급한 뒤 테스트를 시작하세요.'}
          </Text>

          <View style={styles.actionColumn}>
            <AppButton
              label="현재 활성 QR로 인증 시작"
              onPress={() => handleStartWithToken(activeQrSession?.token ?? '')}
              disabled={!activeQrSession || activeStatus !== 'active'}
              loading={working}
            />
            <AppButton
              label="새 QR 발급"
              variant="secondary"
              onPress={handleIssueAndApply}
              disabled={!user}
              loading={issuing}
            />
          </View>
          {!user ? (
            <Text style={styles.supportText}>로그인한 회원만 앱에서 새 동적 QR을 발급할 수 있습니다.</Text>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>수동 토큰 테스트</Text>
          <AppTextField
            label="QR 토큰"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="time-based QR 토큰을 입력하세요"
          />
          <View style={styles.actionRow}>
            <AppButton
              label="수동 인증"
              onPress={() => handleStartWithToken(tokenInput)}
              disabled={!tokenInput.trim()}
              loading={working}
              style={{ flex: 1 }}
            />
            <AppButton
              label="현재 QR 채우기"
              variant="secondary"
              onPress={() => setTokenInput(activeQrSession?.token ?? '')}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        <View style={styles.simulatorCard}>
          <View style={styles.simulatorTop}>
            <Text style={styles.sectionTitle}>디바이스 진행 상태</Text>
            <Text style={[styles.simulationStatus, { color: simulationTone(deviceSimulation.step) }]}>
              {deviceStepLabels[deviceSimulation.step]}
            </Text>
          </View>

          <View style={styles.stepGrid}>
            {deviceStepOrder.map((step, index) => {
              const done = activeStepIndex >= index && deviceSimulation.step !== 'error';
              const active = deviceSimulation.step === step;

              return (
                <DeviceStepCard
                  key={step}
                  label={deviceStepLabels[step]}
                  active={active}
                  done={done}
                />
              );
            })}
          </View>

          <View style={styles.messageCard}>
            <Ionicons
              name={deviceSimulation.step === 'error' ? 'alert-circle' : 'information-circle'}
              size={20}
              color={simulationTone(deviceSimulation.step)}
            />
            <Text style={styles.messageText}>{deviceSimulation.message}</Text>
          </View>

          <View style={styles.hardwareStatusRow}>
            <View style={styles.hardwareChip}>
              <Ionicons
                name={deviceSimulation.lockerOpen ? 'lock-open-outline' : 'lock-closed-outline'}
                size={18}
                color={deviceSimulation.lockerOpen ? colors.accent : colors.textMuted}
              />
              <Text style={styles.hardwareChipText}>
                {deviceSimulation.lockerOpen ? '잠금 해제' : '잠금 유지'}
              </Text>
            </View>
            <View style={styles.hardwareChip}>
              <Ionicons
                name={deviceSimulation.itemDetected ? 'cube-outline' : 'cube'}
                size={18}
                color={deviceSimulation.itemDetected ? colors.success : colors.textMuted}
              />
              <Text style={styles.hardwareChipText}>
                {deviceSimulation.itemDetected ? '물품 감지 완료' : '감지 대기'}
              </Text>
            </View>
          </View>

          <View style={styles.actionColumn}>
            <AppButton
              label="물품 투입 감지"
              onPress={handleItemDetected}
              disabled={deviceSimulation.step !== 'awaiting_item'}
              loading={working}
            />
            <AppButton
              label="시뮬레이터 초기화"
              variant="secondary"
              onPress={resetDeviceSimulation}
            />
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroCard: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  qrPanel: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  qrPanelTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  qrPanelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  qrPanelSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  qrCardFrame: {
    alignSelf: 'center',
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.surfaceWarm,
  },
  qrMatrix: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrCell: {
    width: 8,
    height: 8,
  },
  qrCellOn: {
    backgroundColor: colors.text,
  },
  qrCellOff: {
    backgroundColor: '#fff',
  },
  codeInfoCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    gap: 6,
  },
  codeInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  codeInfoValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.text,
  },
  codeInfoHint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  timerCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  timerValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.brand,
  },
  timerTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  timerFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  actionCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionColumn: {
    gap: spacing.sm,
  },
  supportText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  emptyState: {
    flex: 1,
    minHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.textMuted,
  },
  simulatorCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  simulatorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  simulatorCode: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  formCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  simulationStatus: {
    fontSize: 15,
    fontWeight: '800',
  },
  stepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepCard: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stepCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  stepCardDone: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
  },
  stepDotDone: {
    backgroundColor: colors.brand,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.accent,
  },
  stepLabelDone: {
    color: colors.brand,
  },
  messageCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  hardwareStatusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hardwareChip: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hardwareChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
