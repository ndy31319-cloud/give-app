import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAppContext } from '@/src/context/AppContext';
import { colors } from '@/src/theme/colors';

export function NotificationBell() {
  const { user, unreadNotificationCount: count, refreshNotifications } = useAppContext();
  useFocusEffect(useCallback(() => { void refreshNotifications(); }, [refreshNotifications]));
  return <Pressable accessibilityRole="button" accessibilityLabel={count ? `알림, 읽지 않은 알림 ${count}개` : '알림'}
    hitSlop={6} onPress={() => router.push(user ? '/notifications' : '/login')}
    style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.brandSoft }]}>
    <Ionicons name="notifications-outline" size={23} color={colors.text} />
    {count > 0 && <View style={styles.badge}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, marginLeft: 12 },
  badge: { position: 'absolute', right: -3, top: -3, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 10, lineHeight: 13, color: '#fff', fontWeight: '800' },
});
