import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppButton } from '@/src/components/common/AppButton';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { Inquiry, InquiryPage, inquiryAPI } from '@/src/services/inquiryApi';
import { colors, radius } from '@/src/theme/colors';
const categories: Record<string, string> = { account: '계정', trade: '나눔·거래', error: '앱 오류', other: '기타' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('ko-KR') : '';
const Badge = ({ status }: { status: string }) => <Text style={[styles.badge, status === 'answered' && { backgroundColor: colors.brandSoft, color: colors.brand }]}>{status === 'answered' ? '답변 완료' : status === 'pending' ? '답변 대기' : status}</Text>;

export function InquiryListScreen() {
  const { user, authToken } = useAppContext();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const admin = mode === 'admin';
  const permitted = !admin || user?.roleId === '2';
  const [status, setStatus] = useState(admin ? 'pending' : 'all');
  useEffect(() => { setStatus(admin ? 'pending' : 'all'); }, [admin]);
  const [data, setData] = useState<InquiryPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const version = useRef(0);
  const busy = useRef(false);
  useFocusEffect(useCallback(() => {
    const current = ++version.current; setData(null); setError(null); busy.current = false;
    if (!authToken || !permitted) { setLoading(false); return; }
    setLoading(true);
    void inquiryAPI.list(admin, status, authToken).then(result => {
      if (version.current !== current) return;
      setData(result.data); setError(result.error); setLoading(false);
    });
    return () => { version.current++; };
  }, [admin, status, authToken, permitted, revision]));
  async function more() {
    if (!data?.nextCursor || busy.current || loading) return;
    busy.current = true; setLoading(true); const current = version.current;
    const result = await inquiryAPI.list(admin, status, authToken ?? undefined, data.nextCursor);
    if (version.current !== current) return;
    if (result.data) setData(previous => ({ ...result.data!, items: [...(previous?.items || []), ...result.data!.items.filter(item => !previous?.items.some(old => old.id === item.id))] }));
    setError(result.error); setLoading(false); busy.current = false;
  }
  return <AppScreen scroll contentContainerStyle={styles.page}>
    <AppHeader title={admin ? '문의 관리' : '내 문의함'} />
    {!authToken ? <Text style={styles.muted}>로그인 후 이용해주세요.</Text> : !permitted ? <Text style={styles.error}>관리자만 접근할 수 있어요.</Text> : <>
      <View style={styles.hero}><Ionicons name={admin ? 'chatbubbles-outline' : 'help-circle-outline'} size={24} color={colors.brand} /><View style={{ flex: 1 }}><Text style={styles.title}>{admin ? `답변 대기 ${data?.pendingCount ?? '—'}건` : '궁금한 점을 남겨주세요'}</Text><Text style={styles.muted}>{admin ? '먼저 접수된 문의부터 확인해주세요.' : '답변이 등록되면 알림함으로 알려드려요.'}</Text></View></View>
      {!admin && <AppButton label="문의 작성" onPress={() => router.push('/inquiry-new')} />}
      <View style={styles.tabs}>{(admin ? ['pending', 'answered', 'all'] : ['all', 'pending', 'answered']).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: status === value }} onPress={() => setStatus(value)} style={[styles.tab, value === status && styles.selected]}><Text style={{ color: value === status ? colors.brand : colors.textMuted, fontWeight: '700' }}>{value === 'all' ? '전체' : value === 'pending' ? '답변 대기' : '답변 완료'}</Text></Pressable>)}</View>
      <AppButton label="새로고침" variant="ghost" disabled={loading} onPress={() => setRevision(value => value + 1)} />
      {error && <Text style={styles.error}>{error}</Text>}
      {data?.items.map(item => <Pressable key={item.id} accessibilityRole="button" style={styles.card} onPress={() => router.push(`/inquiry-detail?id=${item.id}`)}>
        <View style={styles.row}><Text style={styles.category}>{categories[item.category] || '기타'}</Text><Badge status={item.status} /></View>
        <Text style={styles.title} numberOfLines={2}>{item.subject}</Text>
        <Text style={styles.muted}>{admin ? `${item.nickname} · ` : ''}{date(item.createdAt)}</Text>
      </Pressable>)}
      {loading && <ActivityIndicator color={colors.brand} />}
      {!loading && !error && data?.items.length === 0 && <View style={styles.card}><Text style={styles.muted}>해당하는 문의가 아직 없어요.</Text></View>}
      {data?.nextCursor && <AppButton label="문의 더 보기" disabled={loading} variant="secondary" onPress={() => void more()} />}
    </>}
  </AppScreen>;
}

export function InquiryComposeScreen() {
  const { user, authToken } = useAppContext();
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [category, setCategory] = useState('other');
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const requestKey = useRef(`inquiry_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const currentToken = useRef(authToken); currentToken.current = authToken;
  async function submit() {
    if (lock.current || !authToken) return;
    lock.current = true; setBusy(true);
    try {
      const result = await inquiryAPI.create({ subject, message, category, requestKey: requestKey.current }, authToken);
      if (currentToken.current !== authToken) return;
      if (!result.data) Alert.alert('문의 접수 실패', result.error || '다시 시도해주세요.');
      else router.replace(`/inquiry-detail?id=${result.data.id}`);
    } finally { lock.current = false; setBusy(false); }
  }
  return <AppScreen scroll contentContainerStyle={styles.page}>
    <AppHeader title="문의 작성" />
    {!user ? <Text style={styles.muted}>로그인 후 이용해주세요.</Text> : <>
      <Text style={styles.muted}>계정에 등록된 정보로 접수돼요. 답변은 내 문의함에서 확인할 수 있어요.</Text>
      <View style={styles.tabs}>{Object.entries(categories).map(([key, label]) => <Pressable key={key} disabled={busy} onPress={() => setCategory(key)} style={[styles.tab, category === key && styles.selected]}><Text style={{ color: category === key ? colors.brand : colors.textMuted }}>{label}</Text></Pressable>)}</View>
      <AppTextField label="제목" placeholder="어떤 도움이 필요한가요?" value={subject} maxLength={200} editable={!busy} onChangeText={setSubject} />
      <AppTextField label="문의 내용" placeholder="문제가 발생한 상황을 자세히 알려주세요." multiline value={message} maxLength={5000} editable={!busy} onChangeText={setMessage} />
      <Text style={styles.muted}>{message.length} / 5000</Text>
      <AppButton label="문의 접수하기" loading={busy} disabled={!subject.trim() || !message.trim() || busy} onPress={() => void submit()} />
    </>}
  </AppScreen>;
}

export function InquiryDetailScreen() {
  const { user, authToken } = useAppContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Inquiry | null>(null); const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0); const [answer, setAnswer] = useState(''); const [busy, setBusy] = useState(false);
  const lock = useRef(false); const version = useRef(0);
  useFocusEffect(useCallback(() => {
    const current = ++version.current; setData(null); setError(null); setAnswer('');
    if (!authToken) { setError('로그인 후 이용해주세요.'); return; }
    void inquiryAPI.detail(String(id), authToken).then(result => { if (current === version.current) { setData(result.data); setError(result.error); } });
    return () => { version.current++; };
  }, [id, authToken, revision]));
  async function reply() {
    if (lock.current || !data || !authToken) return;
    lock.current = true; setBusy(true); const current = version.current;
    try {
      const result = await inquiryAPI.reply(data.id, answer, authToken);
      if (current !== version.current) return;
      if (result.data) { setData(result.data); setAnswer(''); Alert.alert('답변 등록 완료', '문의한 회원에게 알림을 보냈어요.'); }
      else { Alert.alert('답변 등록 실패', result.error || '다시 시도해주세요.'); const latest = await inquiryAPI.detail(data.id, authToken); if (current === version.current && latest.data) setData(latest.data); }
    } finally { lock.current = false; setBusy(false); }
  }
  return <AppScreen scroll contentContainerStyle={styles.page}>
    <AppHeader title="문의 상세" />
    {error ? <><Text style={styles.error}>{error}</Text><AppButton label="다시 불러오기" variant="secondary" onPress={() => setRevision(value => value + 1)} /></> : !data ? <ActivityIndicator color={colors.brand} /> : <>
      <View style={styles.card}><View style={styles.row}><Text style={styles.category}>{categories[data.category] || '기타'}</Text><Badge status={data.status} /></View><Text style={styles.title}>{data.subject}</Text><Text style={styles.muted}>{data.nickname} · {date(data.createdAt)}</Text><Text style={styles.body}>{data.message}</Text></View>
      {data.answer ? <View style={[styles.card, styles.selected]}><Text style={styles.title}>관리자 답변</Text><Text style={styles.muted}>{date(data.answeredAt)}</Text><Text style={styles.body}>{data.answer}</Text></View> : user?.roleId === '2' && data.status === 'pending' ? <View style={styles.card}><Text style={styles.title}>답변 작성</Text><AppTextField multiline placeholder="회원에게 안내할 내용을 작성해주세요." value={answer} maxLength={5000} editable={!busy} onChangeText={setAnswer} /><Text style={styles.muted}>등록하면 답변 완료로 변경되고 회원에게 알림이 전송돼요.</Text><AppButton label="답변 등록" loading={busy} disabled={busy || !answer.trim()} onPress={() => void reply()} /></View> : <View style={styles.card}><Text style={styles.muted}>답변을 기다리고 있어요. 등록되면 알림으로 알려드릴게요.</Text></View>}
    </>}
  </AppScreen>;
}
const styles = StyleSheet.create({
  page: { padding: 18, paddingBottom: 40, gap: 16 }, hero: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12, backgroundColor: colors.brandSoft, borderRadius: radius.lg },
  title: { fontSize: 16, fontWeight: '700', color: colors.text }, muted: { fontSize: 12, lineHeight: 20, color: colors.textMuted }, body: { fontSize: 15, lineHeight: 24, color: colors.text },
  tabs: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, tab: { paddingVertical: 10, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }, selected: { backgroundColor: colors.brandSoft },
  card: { padding: 18, gap: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  category: { color: colors.brand, fontSize: 12, fontWeight: '700' }, badge: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surfaceMuted, color: colors.textMuted, fontSize: 12 }, error: { color: colors.danger, lineHeight: 22 },
});
