import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/src/context/AppContext';
import { loadReputation, Reputation } from '@/src/services/reviewApi';
import { colors, radius } from '@/src/theme/colors';
import { HeartScoreMascot } from './HeartScoreMascot';

export function MemberReputation({ memberId }: { memberId: string }) {
  const { authToken } = useAppContext();
  const normalizedMemberId = String(memberId ?? '').trim();
  const [data, setData] = useState<Reputation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry;
    let active = true; setData(null); setError(null);
    if (!normalizedMemberId) {
      setError('회원 정보를 확인하지 못했습니다.');
      return () => { active = false; };
    }
    void loadReputation(normalizedMemberId, authToken ?? undefined)
      .then(result => { if (active) { setData(result.data); setError(result.error); } })
      .catch(() => { if (active) { setData(null); setError('마음 점수를 불러오지 못했습니다.'); } });
    return () => { active = false; };
  }, [normalizedMemberId, authToken, retry]));
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const reviewCount = Math.max(0, finiteNumber(data?.count) ?? 0);
  const score = finiteNumber(data?.score);
  const positive = Math.max(0, finiteNumber(data?.positive) ?? 0);
  const negative = Math.max(0, finiteNumber(data?.negative) ?? 0);
  const neutral = Math.max(0, finiteNumber(data?.neutral) ?? 0);
  return <View style={styles.card}>
    <HeartScoreMascot score={score} />
    <View style={styles.row}><Ionicons name="heart-outline" size={21} color={colors.brand} /><Text style={styles.title}>마음 점수</Text><Text style={styles.score}>{score === null ? '—' : `${Math.max(0, Math.min(50, score)).toFixed(1)}점`}</Text></View>
    <Text style={styles.hint}>기본 36.5점 · 좋은 평가 +0.5 · 아쉬운 평가 −0.5</Text>
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.error}>{error} 눌러서 다시 시도</Text></Pressable> : !data ? <ActivityIndicator color={colors.brand} /> : <>
      <Text style={styles.count}>받은 후기 {reviewCount}개 · 매너있어요 {positive} · 아쉬워요 {negative}{neutral ? ` · 보통 ${neutral}` : ''}</Text>
      {reviews.length === 0 && <Text style={styles.hint}>아직 받은 거래 후기가 없어요.</Text>}
      {reviews.length > 0 && <ScrollView
        style={styles.reviewScroller}
        contentContainerStyle={styles.reviewList}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        persistentScrollbar
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="받은 후기 목록"
      >
        {reviews.map((review, index) => <View key={String(review?.id ?? `review-${index}`)} style={styles.review}>
          <View style={styles.row}><Text style={styles.label}>{Number(review?.rating) >= 4 ? '매너있어요' : Number(review?.rating) <= 2 ? '아쉬워요' : '보통이에요'}</Text><Text style={styles.hint}>{formatReviewDate(review?.createdAt)}</Text></View>
          <Text style={styles.body}>{String(review?.content ?? '내용이 없는 후기입니다.')}</Text>
        </View>)}
      </ScrollView>}
      {reviewCount > reviews.length && <Text style={styles.hint}>최근 후기 20개를 표시합니다. 점수는 전체 후기를 반영해요.</Text>}
    </>}
  </View>;
}

function formatReviewDate(value: unknown) {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '날짜 확인 중' : date.toLocaleDateString('ko-KR');
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 16 }, score: { color: colors.brand, fontWeight: '800', fontSize: 22 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, count: { color: colors.textMuted, fontSize: 13 }, error: { color: colors.danger, lineHeight: 20 },
  reviewScroller: { maxHeight: 220 }, reviewList: { gap: 12 },
  review: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 6 }, label: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.brand }, body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
