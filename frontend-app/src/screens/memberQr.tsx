import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppScreen } from '@/src/components/common/AppScreen';
import { useAppContext } from '@/src/context/AppContext';
import { buildAuthHeaders, requestEnvelope } from '@/src/services/backendClient';
import { colors, radius, spacing } from '@/src/theme/colors';
import { DeviceSimulatorScreen } from '@/src/screens/device';

type Transfer = { transferId: number; title: string; items: string; recipientNickname: string; status: string };
type Access = { enabled: boolean; role: 'donor' | 'recipient' | null; transfer: Transfer | null };
type MemberQr = { roleId: number; access: Access };
type EligibleTrade = { pickupId: number; title: string; items: string; recipientNickname: string };

export function MemberQrScreen() {
  const { authToken } = useAppContext();
  const [qr, setQr] = useState<MemberQr | null>(null);
  const [eligible, setEligible] = useState<EligibleTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQr = useCallback(async (silent = false) => {
    if (!authToken) {
      setLoading(false);
      setError('로그인 후 회원 QR을 확인할 수 있습니다.');
      return;
    }
    if (!silent) setLoading(true);
    const result = await requestEnvelope<MemberQr>('/api/member-qr/me', {
      headers: buildAuthHeaders(authToken),
    });
    setQr(result.data);
    setError(result.error ?? (result.data ? null : '회원 QR을 불러오지 못했습니다.'));
    if (result.data?.roleId === 1) {
      const trades = await requestEnvelope<EligibleTrade[]>('/api/locker/eligible', {
        headers: buildAuthHeaders(authToken),
      });
      setEligible(trades.data ?? []);
      if (trades.error) setError(trades.error);
    }
    setLoading(false);
  }, [authToken]);

  useFocusEffect(useCallback(() => {
    void loadQr();
    const timer = setInterval(() => void loadQr(true), 15000);
    return () => clearInterval(timer);
  }, [loadQr]));

  const chooseTrade = (trade: EligibleTrade) => {
    Alert.alert('보관함 나눔 확인',
      `게시글: ${trade.title}\n나눔 물품: ${trade.items}\n채팅 상대: ${trade.recipientNickname}\n\n이 분에게 나눔하는 것이 맞나요?`, [
        { text: '아니요', style: 'cancel' },
        { text: '맞아요', onPress: async () => {
          if (!authToken || saving) return;
          setSaving(true);
          const result = await requestEnvelope<Transfer>(`/api/locker/select/${trade.pickupId}`, {
            method: 'POST', headers: buildAuthHeaders(authToken),
          });
          setSaving(false);
          if (result.error) Alert.alert('보관함 선택 실패', result.error);
          else await loadQr();
        } },
      ]);
  };

  const access = qr?.access;

  return (
    <AppScreen scroll contentContainerStyle={styles.content}>
      <AppHeader title="내 회원 QR" />
      {loading ? <ActivityIndicator size="large" color={colors.brand} /> : null}
      {!loading && qr?.roleId === 1 && !access?.transfer ? <View style={styles.card}>
        <Text style={styles.heading}>보관함 나눔 선택</Text>
        <Text style={styles.description}>수락된 나눔의 게시글과 채팅 상대를 확인해주세요.</Text>
        {eligible.length === 0 ? <Text style={styles.description}>선택할 수 있는 나눔이 없어요.</Text> : null}
        {eligible.map((trade) => <Pressable key={trade.pickupId} disabled={saving}
          style={styles.tradeButton} onPress={() => chooseTrade(trade)}>
          <Text style={styles.tradeTitle}>{trade.title}</Text>
          <Text style={styles.tradeText}>{trade.items} · {trade.recipientNickname}님</Text>
        </Pressable>)}
      </View> : null}
      {!loading && error ? <Text style={styles.error}>{error}</Text> : null}
      <DeviceSimulatorScreen embedded />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg },
  heading: { color: colors.text, fontSize: 22, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  tradeText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  tradeTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  tradeButton: { alignSelf: 'stretch', padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.brandSoft, gap: spacing.xs },
  error: { color: colors.danger, textAlign: 'center' },
});
