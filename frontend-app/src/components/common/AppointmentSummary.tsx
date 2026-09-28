import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppointmentDetails, TradeAppointment } from '@/src/types/app';
import { colors, radius } from '@/src/theme/colors';

export function AppointmentSummary({ appointment, inactive = false }: { appointment?: TradeAppointment; inactive?: boolean }) {
  if (!appointment?.confirmed && !appointment?.pending) return null;
  const detail = (value: AppointmentDetails, title: string, pending: boolean) => <View style={[styles.box, pending && styles.pending]}>
    <View style={styles.heading}><Ionicons name={pending ? 'time-outline' : 'calendar-outline'} size={17} color={colors.brand} /><Text style={styles.label}>{title}</Text></View>
    <Text style={styles.time}>{new Date(value.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
    <Text style={styles.place}>{value.place}</Text>
    {value.latitude !== null && value.longitude !== null && <Pressable accessibilityRole="link" onPress={() => {
      void Linking.openURL(`https://map.kakao.com/link/map/${encodeURIComponent(value.place)},${value.latitude},${value.longitude}`).catch(() => Alert.alert('지도를 열 수 없어요', '잠시 후 다시 시도해주세요.'));
    }}><Text style={styles.link}>카카오맵에서 보기 ↗</Text></Pressable>}
  </View>;
  return <View style={{ gap: 8 }}>
    {appointment.confirmed && detail(appointment.confirmed, inactive ? '거래 종료 · 확정했던 약속' : '확정된 약속', false)}
    {appointment.pending && detail(appointment.pending, inactive ? '거래 종료 · 미확정 제안' : appointment.confirmed ? '변경 제안 · 상대방 확인 대기' : '약속 제안 · 상대방 확인 대기', true)}
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: 13, gap: 6, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  pending: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 }, label: { fontSize: 12, color: colors.brand, fontWeight: '700' },
  time: { fontSize: 14, color: colors.text, fontWeight: '700' }, place: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  link: { paddingVertical: 6, color: colors.brand, fontSize: 12, fontWeight: '600' },
});
