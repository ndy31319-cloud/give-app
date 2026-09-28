import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/src/context/AppContext';
import { loadReputation, Reputation } from '@/src/services/reviewApi';
import { colors, radius } from '@/src/theme/colors';

export function MemberReputation({ memberId }: { memberId: string }) {
  const { authToken } = useAppContext();
  const [data, setData] = useState<Reputation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true; setData(null); setError(null);
    void loadReputation(memberId, authToken ?? undefined).then(result => { if (active) { setData(result.data); setError(result.error); } });
    return () => { active = false; };
  }, [memberId, authToken, retry]));
  return <View style={styles.card}>
    <View style={styles.row}><Ionicons name="heart-outline" size={21} color={colors.brand} /><Text style={styles.title}>마음 점수</Text><Text style={styles.score}>{data ? `${data.score.toFixed(1)}점` : '—'}</Text></View>
    <Text style={styles.hint}>기본 36.5점 · 좋은 평가 +0.5 · 아쉬운 평가 −0.5</Text>
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.error}>{error} 눌러서 다시 시도</Text></Pressable> : !data ? <ActivityIndicator color={colors.brand} /> : <>
      <Text style={styles.count}>받은 후기 {data.count}개 · 매너있어요 {data.positive} · 아쉬워요 {data.negative}{data.neutral ? ` · 보통 ${data.neutral}` : ''}</Text>
      {data.reviews.length === 0 && <Text style={styles.hint}>아직 받은 거래 후기가 없어요.</Text>}
      {data.reviews.map(review => <View key={review.id} style={styles.review}>
        <View style={styles.row}><Text style={styles.label}>{review.rating >= 4 ? '매너있어요' : review.rating <= 2 ? '아쉬워요' : '보통이에요'}</Text><Text style={styles.hint}>{new Date(review.createdAt).toLocaleDateString('ko-KR')}</Text></View>
        <Text style={styles.body}>{review.content}</Text>
      </View>)}
      {data.count > data.reviews.length && <Text style={styles.hint}>최근 후기 20개를 표시합니다. 점수는 전체 후기를 반영해요.</Text>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 16 }, score: { color: colors.brand, fontWeight: '800', fontSize: 22 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 }, count: { color: colors.textMuted, fontSize: 13 }, error: { color: colors.danger, lineHeight: 20 },
  review: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 6 }, label: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.brand }, body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
