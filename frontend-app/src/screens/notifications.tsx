import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { AppScreen } from '@/src/components/common/AppScreen';
import { useAppContext } from '@/src/context/AppContext';
import { notificationAPI } from '@/src/services/api';
import { NotificationItem } from '@/src/types/app';
import { colors, radius } from '@/src/theme/colors';

function dayLabel(createdAt?: string) {
  if (!createdAt) return '이전 알림';
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return '오늘';
  if (date.toDateString() === yesterday.toDateString()) return '어제';
  return date.toLocaleDateString('ko-KR', { year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric', month: 'long', day: 'numeric' });
}
function noticeIcon(code?: string): keyof typeof Ionicons.glyphMap {
  if (code === 'request') return 'calendar-outline';
  if (code === 'pickup_approved') return 'checkmark-circle-outline';
  if (code === 'pickup_completed') return 'heart-outline';
  if (code === 'pickup_expired') return 'time-outline';
  if (code === 'pickup_canceled' || code === 'pickup_rejected') return 'close-circle-outline';
  if (code === 'chat' || code === 'chat_message') return 'chatbubble-ellipses-outline';
  return 'gift-outline';
}

export function NotificationsScreen() {
  const { authToken, unreadNotificationCount, refreshNotifications, markNotificationRead, openChatRoom } = useAppContext();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const openingLock = useRef(false);
  const allReadLock = useRef(false);
  const currentAuthToken = useRef(authToken);
  currentAuthToken.current = authToken;
  const load = useCallback(async (before?: string) => {
    if (currentAuthToken.current !== authToken) return;
    if (before && busy.current) return;
    const version = ++requestVersion.current;
    if (!authToken) { busy.current = false; setLoading(false); setItems([]); setError('로그인 후 알림을 확인할 수 있어요.'); return; }
    busy.current = true; setLoading(true); setLoadingMore(Boolean(before)); setError(null);
    const result = await notificationAPI.feed(authToken, before, unreadOnly);
    if (version !== requestVersion.current || currentAuthToken.current !== authToken) return;
    if (result.error) setError(result.error);
    else {
      setItems(previous => before ? [...previous, ...result.data.items.filter(next => !previous.some(old => old.id === next.id))] : result.data.items);
      setCursor(result.data.nextCursor);
    }
    busy.current = false; setLoading(false);
  }, [authToken, unreadOnly]);

  useFocusEffect(useCallback(() => {
    setItems([]); setCursor(null);
    void load(); void refreshNotifications();
    return () => { requestVersion.current++; busy.current = false; };
  }, [load, refreshNotifications]));

  async function openNotification(item: NotificationItem) {
    if (openingLock.current || allReadLock.current) return;
    openingLock.current = true; setOpening(item.id);
    try {
      const read = await markNotificationRead(item.id);
      if (read.error) { Alert.alert('알림 확인 실패', read.error); return; }
      requestVersion.current++; busy.current = false; setLoading(false);
      setItems(previous => unreadOnly ? previous.filter(row => row.id !== item.id) : previous.map(row => row.id === item.id ? { ...row, isRead: true } : row));
      if (item.target?.type === 'chat') {
        const result = await openChatRoom(item.target.roomId);
        if (result.error) Alert.alert('채팅방 연결 안내', result.error);
        else router.push(`/chat/${item.target.roomId}`);
      } else if (item.target?.type === 'post') router.push(`/post/${item.target.postId}`);
      else if (item.target?.type === 'inquiry') router.push(`/inquiry-detail?id=${item.target.inquiryId}`);
      else Alert.alert(item.title, `${item.message}\n\n연결된 거래나 게시글이 더 이상 없을 수 있습니다.`);
    } finally { openingLock.current = false; setOpening(null); }
  }
  async function readAll() {
    if (allReadLock.current || openingLock.current || !items.length || !authToken) return;
    allReadLock.current = true; setMarkingAll(true);
    try {
      const latest = items.reduce((max, item) => Math.max(max, Number(item.id)), 0);
      const result = await notificationAPI.markAllRead(String(latest), authToken);
      if (currentAuthToken.current !== authToken) return;
      if (result.error || !result.data) { Alert.alert('읽음 처리 실패', result.error || '잠시 후 다시 시도해주세요.'); return; }
      await refreshNotifications(); await load();
    } finally { allReadLock.current = false; setMarkingAll(false); }
  }

  return <AppScreen>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" hitSlop={8} onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <View style={styles.heading}><Text style={styles.title}>알림</Text><Text style={styles.subtitle}>나눔의 새로운 소식을 모았어요</Text></View>
      <Pressable accessibilityRole="button" disabled={!unreadNotificationCount || markingAll || loading || !items.length}
        onPress={() => void readAll()} style={styles.readAll}>
        <Text style={[styles.readAllText, (!unreadNotificationCount || markingAll) && { color: colors.textLight }]}>{markingAll ? '처리 중' : '모두 읽음'}</Text>
      </Pressable>
    </View>
    <View style={styles.toolbar}>
      <View style={styles.filters}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: unreadOnly === value }}
        onPress={() => setUnreadOnly(value)} style={[styles.filter, unreadOnly === value && styles.filterActive]}>
        <Text style={[styles.filterText, unreadOnly === value && { color: colors.brand }]}>{value ? '안 읽음' : '전체'}</Text>
        {value && unreadNotificationCount > 0 && <Text style={styles.filterCount}>{unreadNotificationCount}</Text>}
      </Pressable>)}</View>
      <Pressable accessibilityLabel="알림 새로고침" accessibilityRole="button" disabled={loading} onPress={() => { void load(); void refreshNotifications(); }} style={styles.refresh}>
        <Ionicons name="refresh-outline" size={19} color={colors.textMuted} />
      </Pressable>
    </View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <FlatList data={items} keyExtractor={item => item.id} contentContainerStyle={styles.list}
      refreshing={loading && items.length > 0 && !loadingMore} onRefresh={() => { void load(); void refreshNotifications(); }}
      ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 30 }} color={colors.brand} /> : !error ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><Ionicons name="notifications-outline" size={26} color={colors.brand} /></View>
        <View style={{ flex: 1 }}><Text style={styles.emptyTitle}>{unreadOnly ? '새 알림을 모두 확인했어요' : '아직 도착한 알림이 없어요'}</Text>
          <Text style={styles.emptyText}>나눔 요청과 거래 소식이 오면 여기에 알려드릴게요.</Text></View>
      </View> : null}
      ListFooterComponent={cursor ? <Pressable disabled={loading} onPress={() => void load(cursor)} style={styles.more}>
        {loading ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.readAllText}>이전 알림 더 보기</Text>}
      </Pressable> : <View style={{ height: 16 }} />}
      renderItem={({ item, index }) => {
        const group = dayLabel(item.createdAt);
        const showDay = index === 0 || dayLabel(items[index - 1].createdAt) !== group;
        return <View>
          {showDay && <Text style={styles.day}>{group}</Text>}
          <Pressable accessibilityRole="button" disabled={opening !== null || markingAll} onPress={() => void openNotification(item)}
            style={({ pressed }) => [styles.card, !item.isRead && styles.unread, pressed && { opacity: 0.75 }]}>
            <View style={[styles.icon, !item.isRead && { backgroundColor: colors.brandSoft }]}>
              <Ionicons name={noticeIcon(item.notificationTypeCode)} size={23} color={item.isRead ? colors.textMuted : colors.brand} />
            </View>
            <View style={styles.body}>
              <View style={styles.row}><Text style={[styles.cardTitle, item.isRead && { color: colors.textMuted }]}>{item.title}</Text>{!item.isRead && <View style={styles.dot} />}</View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{item.timeLabel}</Text>
            </View>
            {opening === item.id ? <ActivityIndicator size="small" color={colors.brand} /> : item.target ? <Ionicons name="chevron-forward" size={16} color={colors.textLight} /> : null}
          </Pressable>
        </View>;
      }} />
  </AppScreen>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18, backgroundColor: colors.surface, gap: 12 },
  back: { width: 32, height: 42, justifyContent: 'center' },
  heading: { flex: 1, gap: 5 }, title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted }, readAll: { paddingVertical: 12, paddingLeft: 5 },
  readAllText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  filters: { flexDirection: 'row', gap: 8 }, filter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  filterActive: { backgroundColor: colors.brandSoft }, filterText: { fontSize: 13, fontWeight: '700', color: colors.textMuted }, filterCount: { fontSize: 12, fontWeight: '800', color: colors.brand }, refresh: { padding: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 28 }, day: { marginTop: 24, marginBottom: 10, color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, marginBottom: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  unread: { borderColor: '#cfe6d7', backgroundColor: '#f5fbf7' }, icon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceMuted },
  body: { flex: 1, gap: 6 }, row: { flexDirection: 'row', alignItems: 'center', gap: 6 }, cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand }, message: { fontSize: 13, lineHeight: 20, color: colors.textMuted }, time: { fontSize: 11, color: colors.textLight },
  empty: { marginTop: 24, padding: 20, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14 },
  emptyIcon: { padding: 12, borderRadius: 16, backgroundColor: colors.brandSoft }, emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text }, emptyText: { marginTop: 7, fontSize: 13, lineHeight: 20, color: colors.textMuted },
  more: { alignItems: 'center', padding: 18 }, error: { margin: 20, color: colors.danger, fontSize: 13 },
});
