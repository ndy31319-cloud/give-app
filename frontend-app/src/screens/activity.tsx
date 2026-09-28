import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppButton } from '@/src/components/common/AppButton';
import { AppointmentSummary } from '@/src/components/common/AppointmentSummary';
import { useAppContext } from '@/src/context/AppContext';
import { ActivityData, ActivityPost, ActivityTrade, loadActivity } from '@/src/services/activityApi';
import { colors, radius, spacing } from '@/src/theme/colors';

type Tab = 'donatedPosts' | 'sentRequests' | 'receivedRequests' | 'requestedPosts';
const tabs: { key: Tab; label: string; empty: string }[] = [
  { key: 'donatedPosts', label: '내 나눔', empty: '아직 등록한 나눔 물품이 없어요.' },
  { key: 'receivedRequests', label: '받은 신청', empty: '내 나눔 물품에 들어온 신청이 없어요.' },
  { key: 'requestedPosts', label: '내 요청글', empty: '아직 작성한 물품 요청글이 없어요.' },
  { key: 'sentRequests', label: '보낸 신청', empty: '아직 다른 분의 나눔에 신청한 내역이 없어요.' },
];
const tradeLabels: Record<string, string> = {
  pending: '수락 대기', approved: '예약 확정', completed: '나눔 완료',
  rejected: '거절됨', canceled: '취소됨', expired: '기간 만료',
};
const postLabels: Record<string, string> = {
  open: '나눔 중', reserved: '예약 중', completed: '완료', canceled: '취소됨',
  stored: '보관 완료', storage_requested: '보관 요청', hidden: '숨김', pickup_pending: '수령 대기',
};
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('ko-KR') : '';

function Thumbnail({ image }: { image: string | null }) {
  return image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
    : <View style={[styles.image, styles.placeholder]}><Ionicons name="image-outline" size={26} color={colors.textMuted} /></View>;
}
function Status({ label, status }: { label: string; status: string }) {
  const completed = status === 'completed';
  const active = ['pending', 'approved', 'reserved', 'open'].includes(status);
  return <View style={[styles.badge, completed && { backgroundColor: colors.successSoft }, active && { backgroundColor: colors.brandSoft }]}>
    <Text style={[styles.badgeText, completed && { color: colors.success }, active && { color: colors.brand }]}>{label}</Text>
  </View>;
}

export function MyActivityScreen() {
  const { user, authToken, openChatRoom } = useAppContext();
  const isBeneficiary = user?.roleCode === 'BENEFICIARY' || user?.roleId === '3' || user?.isVulnerable === true;
  const visibleTabs = tabs.filter(item => isBeneficiary
    ? item.key === 'requestedPosts' || item.key === 'sentRequests'
    : item.key === 'donatedPosts' || item.key === 'receivedRequests');
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [selectedTab, setTab] = useState<Tab>(() => tabs.find(item => item.key === initialTab)?.key || visibleTabs[0].key);
  // A stale selection or a manually entered link must not show another role's tab.
  const tab = visibleTabs.some(item => item.key === selectedTab) ? selectedTab : visibleTabs[0].key;
  const [postFilter, setPostFilter] = useState<string | null>(null);
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const opening = useRef(false);
  useEffect(() => { setPostFilter(null); }, [user?.id, isBeneficiary]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null);
    setError(null);
    if (!authToken) {
      setError('로그인 후 활동 내역을 확인할 수 있습니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    loadActivity(authToken).then(result => {
      if (!active) return;
      setData(result.data);
      setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [authToken, revision]));

  async function openTrade(trade: ActivityTrade) {
    if (!trade.roomId || opening.current) return;
    opening.current = true;
    setOpeningId(trade.id);
    try {
      const result = await openChatRoom(trade.roomId);
      if (result.error) Alert.alert('채팅방 연결 안내', result.error);
      else router.push(`/chat/${trade.roomId}`);
    } finally { opening.current = false; setOpeningId(null); }
  }

  const renderPost = (post: ActivityPost) => {
    const received = data?.receivedRequests.filter(request => request.postId === post.id) || [];
    const status = post.type === 'request' && post.status === 'open' ? '요청 중' : postLabels[post.status] || post.status;
    return <View key={post.id} style={styles.card}>
      <View style={styles.row}>
        <Thumbnail image={post.image} />
        <View style={styles.detail}>
          <Text style={styles.title}>{post.title}</Text>
          <Status status={post.status} label={status} />
          <Text style={styles.muted}>등록일 {dateLabel(post.createdAt)}</Text>
          {post.type === 'donate' && <Text style={styles.muted}>받은 신청 {received.length}건</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton label="게시글 보기" variant="secondary" onPress={() => router.push(`/post/${post.id}`)} style={{ flex: 1 }} />
        {received.length > 0 && <AppButton label="받은 신청 보기" onPress={() => { setTab('receivedRequests'); setPostFilter(post.id); }} style={{ flex: 1 }} />}
      </View>
    </View>;
  };
  const renderTrade = (trade: ActivityTrade) => <View key={trade.id} style={styles.card}>
    <View style={styles.row}>
      <Thumbnail image={trade.image} />
      <View style={styles.detail}>
        <Text style={styles.title}>{trade.title}</Text>
        <Status status={trade.status} label={tradeLabels[trade.status] || trade.status} />
        <Text style={styles.muted}>{tab === 'sentRequests' ? `나눔하는 분: ${trade.donorName}` : `신청한 분: ${trade.requesterName}`}</Text>
        <Text style={styles.muted}>신청일 {dateLabel(trade.createdAt)}</Text>
      </View>
    </View>
    {trade.status === 'pending' && trade.expiresAt && <Text style={styles.muted}>응답 기한: {new Date(trade.expiresAt).toLocaleString('ko-KR')}</Text>}
    <AppointmentSummary appointment={trade.appointment} inactive={trade.status !== 'approved'} />
    <View style={styles.actions}>
      <AppButton label="게시글 보기" variant="secondary" onPress={() => router.push(`/post/${trade.postId}`)} style={{ flex: 1 }} />
      {trade.roomId && <AppButton label={openingId === trade.id ? '연결 중' : '채팅방으로 이동'} disabled={openingId !== null} onPress={() => void openTrade(trade)} style={{ flex: 1 }} />}
    </View>
    {!trade.roomId && <Text style={styles.muted}>이 신청에는 연결된 채팅방이 없습니다.</Text>}
  </View>;

  const isTradeTab = tab === 'sentRequests' || tab === 'receivedRequests';
  const trades = data && isTradeTab ? data[tab].filter(item => !postFilter || item.postId === postFilter) : [];
  const posts = data && !isTradeTab ? data[tab] : [];
  return <AppScreen scroll contentContainerStyle={styles.page}>
    <AppHeader title="신청·나눔 내역" />
    <Text style={styles.description}>{isBeneficiary ? '내 요청글과 다른 분의 나눔에 보낸 신청을 확인하세요.' : '내 나눔 물품과 받은 신청을 확인하세요.'}</Text>
    <View style={styles.tabs}>
      {visibleTabs.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }}
        style={[styles.tab, tab === item.key && styles.selected]} onPress={() => { setTab(item.key); setPostFilter(null); }}>
        <Text style={[styles.tabText, tab === item.key && { color: '#fff' }]}>{item.label}{data ? ` ${data[item.key].length}` : ''}</Text>
      </Pressable>)}
    </View>
    {postFilter && <AppButton label="이 물품의 신청만 보는 중 · 전체 보기" variant="ghost" onPress={() => setPostFilter(null)} />}
    <AppButton label={loading ? '불러오는 중' : '새로고침'} variant="secondary" disabled={loading} onPress={() => setRevision(value => value + 1)} />
    {loading && <ActivityIndicator size="large" color={colors.brand} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!loading && !error && data && <>
      {isTradeTab ? trades.map(renderTrade) : posts.map(renderPost)}
      {(isTradeTab ? trades.length : posts.length) === 0 && <Text style={styles.empty}>{tabs.find(item => item.key === tab)?.empty}</Text>}
    </>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  description: { color: colors.textMuted, lineHeight: 22 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { width: '48%', flexGrow: 1, paddingVertical: 13, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  selected: { backgroundColor: colors.brand },
  tabText: { color: colors.text, fontWeight: '700' },
  card: { padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  image: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  detail: { flex: 1, gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  badgeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  empty: { paddingVertical: 35, textAlign: 'center', color: colors.textMuted },
  error: { color: colors.danger, paddingVertical: 20 },
});
