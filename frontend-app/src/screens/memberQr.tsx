import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppScreen } from '@/src/components/common/AppScreen';
import { useAppContext } from '@/src/context/AppContext';
import { buildAuthHeaders, requestEnvelope } from '@/src/services/backendClient';
import { colors, radius, spacing } from '@/src/theme/colors';

type Transfer = { transferId: number; title: string; items: string; recipientNickname: string; status: string };
type Access = { enabled: boolean; role: 'donor' | 'recipient' | null; transfer: Transfer | null };
type MemberQr = { memberId: number; nickname: string; roleId: number; imageDataUrl: string; access: Access };
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
  const message = !access?.transfer
    ? '보관함 나눔을 선택하면 QR을 사용할 수 있어요.'
    : access.role === 'donor' && access.enabled
      ? '보관함에 물품을 넣을 때 이 QR을 보여주세요.'
      : access.role === 'recipient' && access.enabled
        ? '물품이 준비됐어요. 보관함에서 이 QR을 보여주세요.'
        : access.role === 'recipient'
          ? '나눔 물품이 준비되면 이 QR을 사용할 수 있어요.'
          : '현재 사용할 수 있는 보관함 거래가 없어요.';

  return (
    <AppScreen scroll contentContainerStyle={styles.content}>
      <AppHeader title="내 회원 QR" />
      {loading ? <ActivityIndicator size="large" color={colors.brand} /> : null}
      {!loading && qr ? <View style={styles.card}>
        <Text style={styles.heading}>내 회원 QR</Text>
        <Text style={styles.description}>{message}</Text>
        <View style={styles.qrFrame}>
          <Image source={{ uri: qr.imageDataUrl }} style={styles.qrImage} resizeMode="contain"
            accessibilityLabel={`${qr.nickname} 회원 QR`} />
          {!access?.enabled ? <View style={styles.cover}>
            <Text style={styles.coverIcon}>🔒</Text>
            <Text style={styles.coverText}>보관함 사용 대기 중</Text>
          </View> : null}
        </View>
        <Text style={styles.name}>{qr.nickname}</Text>
        {access?.transfer ? <Text style={styles.tradeText}>
          {access.transfer.title} · {access.transfer.items}
        </Text> : null}
        <Pressable onPress={() => void loadQr()} style={styles.refreshButton}>
          <Text style={styles.refreshText}>상태 새로고침</Text>
        </Pressable>
      </View> : null}
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg },
  heading: { color: colors.text, fontSize: 22, fontWeight: '800' },
  description: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  qrFrame: { width: 280, height: 280, marginVertical: spacing.md, position: 'relative' },
  qrImage: { width: 280, height: 280 },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(225, 229, 225, 0.96)', alignItems: 'center',
    justifyContent: 'center', borderRadius: radius.md, gap: spacing.sm },
  coverIcon: { fontSize: 38 },
  coverText: { color: colors.textMuted, fontSize: 18, fontWeight: '800' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  tradeText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  tradeTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  tradeButton: { alignSelf: 'stretch', padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.brandSoft, gap: spacing.xs },
  refreshButton: { padding: spacing.sm },
  refreshText: { color: colors.brand, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
});
