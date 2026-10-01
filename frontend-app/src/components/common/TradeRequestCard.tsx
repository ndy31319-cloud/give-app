import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { AppModal } from './AppModal';
import { AppTextField } from './AppTextField';
import { AppointmentSummary } from './AppointmentSummary';
import { useAppContext } from '@/src/context/AppContext';
import { tradeAPI } from '@/src/services/tradeApi';
import { TradeAction, TradeRequest } from '@/src/types/app';
import { colors, radius, spacing } from '@/src/theme/colors';

const labels = {
  pending: '수락 대기', approved: '예약 확정', rejected: '거절됨',
  canceled: '취소됨', expired: '응답 시간 만료', completed: '나눔 완료',
};

export function TradeRequestCard({ request, onSchedule, onReview }: { request: TradeRequest; onSchedule?: (trade: TradeRequest) => void; onReview?: () => void }) {
  const { user, authToken, applyTrade } = useAppContext();
  const [trade, setTrade] = useState(request);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const acting = useRef(false);
  const actionVersion = useRef(0);
  const isDonor = String(user?.id) === trade.donorId;
  const isRequester = String(user?.id) === trade.requesterId;

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const version = actionVersion.current;
      const result = await tradeAPI.get(request.id, authToken ?? undefined);
      if (mounted && result.data && !acting.current && version === actionVersion.current) {
        setTrade(result.data);
        setVerified(true);
      }
    }
    setVerified(false);
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { mounted = false; clearInterval(timer); };
  }, [request.id, request.status, request.appointment?.revision, authToken]);

  async function confirmAppointment() {
    if (acting.current) return;
    actionVersion.current++;
    acting.current = true; setBusy(true);
    try {
      const result = await tradeAPI.confirmAppointment(trade.id, trade.appointment?.revision || 0, authToken ?? undefined);
      if (result.data) { setTrade(result.data); applyTrade(result.data); }
      else {
        Alert.alert('약속 확인', result.error || '다시 시도해주세요.');
        const latest = await tradeAPI.get(trade.id, authToken ?? undefined);
        if (latest.data) setTrade(latest.data);
      }
    } finally { acting.current = false; setBusy(false); }
  }

  // Only active transactions and explicit local actions update the post list.
  // Historical canceled cards must not reopen a newer reservation.
  async function act(action: TradeAction, reason?: string) {
    if (acting.current) return;
    actionVersion.current++;
    acting.current = true;
    setBusy(true);
    try {
      const result = await tradeAPI.act(trade.id, action, authToken ?? undefined, reason);
      if (result.error || !result.data) {
        if (action === 'cancel') setCancelError(result.error || '잠시 후 다시 시도해주세요.');
        else Alert.alert('처리 실패', result.error || '잠시 후 다시 시도해주세요.');
        const latest = await tradeAPI.get(trade.id, authToken ?? undefined);
        if (latest.data) setTrade(latest.data);
      } else {
        setTrade(result.data);
        applyTrade(result.data);
        if (action === 'cancel') {
          setCancelOpen(false);
          setCancelReason('');
          setCancelError('');
        }
      }
    } finally { acting.current = false; setBusy(false); }
  }

  const button = (label: string, action: TradeAction, secondary = false) => (
    <AppButton label={label} disabled={busy || !verified} onPress={() => {
      if (action === 'cancel') { setCancelError(''); setCancelOpen(true); }
      else void act(action);
    }}
      variant={secondary ? 'secondary' : 'primary'} style={{ flex: 1 }} />
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{trade.requesterName}님이 나눔을 요청했어요!</Text>
      <Text style={styles.item}>{trade.title}</Text>
      <Text style={styles.status}>{labels[trade.status]}</Text>
      {trade.status === 'canceled' && trade.cancelReason ? <Text style={styles.hint}>취소 사유: {trade.cancelReason}</Text> : null}
      {trade.status === 'completed' && (isDonor || isRequester) && onReview && <AppButton label="거래 후기" variant="secondary" onPress={onReview} />}
      {trade.status === 'pending' && (
        <Text style={styles.hint}>수락하면 예약이 확정됩니다. 요청 후 24시간 안에 응답이 없으면 자동 취소됩니다.</Text>
      )}
      <AppointmentSummary appointment={trade.appointment} inactive={trade.status !== 'approved'} />
      {trade.status === 'approved' && (isDonor || isRequester) && <>
        {!trade.appointment?.confirmed && !trade.appointment?.pending && <Text style={styles.hint}>만날 장소와 시간을 제안해주세요. 상대방이 확인하면 약속이 확정돼요.</Text>}
        <View style={styles.actions}>
          {onSchedule && <AppButton style={{ flex: 1 }} label={trade.appointment?.pending || trade.appointment?.confirmed ? '약속 변경 제안' : '약속 잡기'} variant="secondary" disabled={busy || !verified} onPress={() => onSchedule(trade)} />}
          {trade.appointment?.pending && trade.appointment.pending.proposedBy !== String(user?.id) && <AppButton style={{ flex: 1 }} label="약속 확정" disabled={busy || !verified} onPress={() => void confirmAppointment()} />}
        </View>
      </>}
      {trade.status === 'pending' && isDonor && <View style={styles.actions}>
        {button('수락', 'approve')}{button('거절', 'reject', true)}
      </View>}
      {trade.status === 'pending' && isRequester && button('요청 취소', 'cancel', true)}
      {trade.status === 'approved' && (isDonor || isRequester) && <View style={styles.actions}>
        {isDonor && button('나눔 완료', 'complete')}{button('거래 취소', 'cancel', true)}
      </View>}
      <AppModal visible={cancelOpen} avoidKeyboard onClose={() => { if (!acting.current) { Keyboard.dismiss(); setCancelOpen(false); } }}>
        <Text style={styles.title}>거래 취소 사유</Text>
        <Text style={styles.hint}>취소 사유를 간단히 적어주세요. 상대방도 확인할 수 있어요.</Text>
        <AppTextField
          accessibilityLabel="거래 취소 사유"
          value={cancelReason}
          onChangeText={value => { setCancelReason(value); setCancelError(''); }}
          placeholder="예: 약속한 시간에 만나기 어려워요"
          multiline
          maxLength={200}
          editable={!busy}
          error={cancelError}
          hint={`${cancelReason.length}/200자`}
          style={styles.cancelInput}
        />
        <View style={styles.actions}>
          <AppButton label="돌아가기" variant="secondary" disabled={busy} style={{ flex: 1 }} onPress={() => { Keyboard.dismiss(); setCancelOpen(false); }} />
          <AppButton label="취소 확정" variant="danger" loading={busy} disabled={!cancelReason.trim()} style={{ flex: 1 }} onPress={() => {
            const reason = cancelReason.trim();
            if (!reason || acting.current) return;
            Keyboard.dismiss();
            void act('cancel', reason);
          }} />
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, marginVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  item: { fontSize: 14, color: colors.textMuted },
  status: { color: colors.brand, fontWeight: '700' },
  hint: { color: colors.textMuted, lineHeight: 20 },
  cancelInput: { minHeight: 96, maxHeight: 140 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
