import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppModal } from '@/src/components/common/AppModal';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { mockShareHistory, neighborhoodOptions } from '@/src/data/mockData';
import { MypageStats, mypageAPI } from '@/src/services/api';
import { colors, radius, spacing } from '@/src/theme/colors';
import { NeighborhoodLocation, ShareHistoryItem } from '@/src/types/app';
import { getEffectiveQrStatus, getQrStatusLabel, getRemainingSeconds } from '@/src/utils/dynamicQr';
import { pickImageFromLibrary } from '@/src/utils/imagePicker';
import { formatCompactLocation, searchLocations } from '@/src/utils/location';

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </Pressable>
  );
}

export function MyPageScreen() {
  const { user, authToken, activeQrSession, deviceSimulation } = useAppContext();
  const [counts, setCounts] = useState({ shares: 0, requests: 0 });
  const qrStatus = getEffectiveQrStatus(activeQrSession);
  const remainingSeconds = getRemainingSeconds(activeQrSession?.expiresAt);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (!authToken) {
        return;
      }

      const result = await mypageAPI.summary(authToken);
      if (mounted && result.data?.counts) {
        setCounts(result.data.counts);
      }
    }

    loadSummary();
    return () => {
      mounted = false;
    };
  }, [authToken]);

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>마이페이지</Text>
        <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileAvatarLarge}>
          {user?.profileImage ? (
            <Image source={{ uri: user.profileImage }} style={styles.profileImage} contentFit="cover" />
          ) : (
            <Ionicons name="person" size={38} color={colors.textMuted} />
          )}
        </View>
        <Text style={styles.profileName}>{user?.name ?? '사용자'}</Text>
        {user?.nickname ? <Text style={styles.profileNickname}>@{user.nickname}</Text> : null}
        <Text style={styles.profileLocation}>{user ? formatCompactLocation(user.location) : '동네 미설정'}</Text>
        <AppButton label="프로필 수정" variant="secondary" onPress={() => router.push('/profile-edit')} />
      </View>

      <View style={styles.statsSummary}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{counts.shares}</Text>
          <Text style={styles.statLabel}>나눔</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{counts.requests}</Text>
          <Text style={styles.statLabel}>신청</Text>
        </View>
      </View>

      <View style={styles.highlightPanel}>
        <Text style={styles.highlightPanelTitle}>동적 QR 인증</Text>
        <Text style={styles.highlightPanelText}>
          {activeQrSession
            ? `현재 상태는 ${getQrStatusLabel(qrStatus)}이며 ${
                qrStatus === 'active' ? `${remainingSeconds}초 후 만료` : '새 발급이 필요'
              }합니다.`
            : '아직 발급된 동적 QR이 없습니다. 마이페이지에서 바로 발급하고 기부함 시뮬레이터까지 테스트할 수 있습니다.'}
        </Text>
        <Text style={[styles.highlightPanelText, { marginTop: 8 }]}>
          디바이스 상태: {deviceSimulation.message}
        </Text>
      </View>

      <View style={styles.menuCard}>
        <MenuRow icon="location-outline" label="내 동네 설정" onPress={() => router.push('/my-location')} />
        <MenuRow icon="qr-code-outline" label="동적 QR 인증" onPress={() => router.push('/qr')} />
        <MenuRow icon="hardware-chip-outline" label="기부함 디바이스 시뮬레이터" onPress={() => router.push('/device')} />
        <MenuRow icon="heart-outline" label="나의 나눔/활동" onPress={() => router.push('/my-shares')} />
        <MenuRow icon="bar-chart-outline" label="나눔통계" onPress={() => router.push('/my-stats')} />
        <MenuRow icon="chatbubble-ellipses-outline" label="관리자에게 문의하기" onPress={() => router.push('/contact-admin')} />
      </View>
    </AppScreen>
  );
}

export function ProfileEditScreen() {
  const { user, updateProfile } = useAppContext();
  const [formData, setFormData] = useState({
    name: user?.name ?? '홍길동',
    nickname: user?.nickname ?? '나눔이웃',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
    bio: user?.bio ?? '',
    profileImage: user?.profileImage ?? '',
  });

  const changeProfileImage = async () => {
    const image = await pickImageFromLibrary();
    if (image) {
      setFormData((prev) => ({ ...prev, profileImage: image.uri }));
    }
  };

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="프로필 수정" />
      <View style={styles.profileCard}>
        <Pressable style={styles.profileAvatarLarge} onPress={changeProfileImage}>
          {formData.profileImage ? (
            <Image source={{ uri: formData.profileImage }} style={styles.profileImage} contentFit="cover" />
          ) : (
            <Ionicons name="camera-outline" size={34} color={colors.textMuted} />
          )}
        </Pressable>
        <Text style={styles.profileLocation}>프로필 사진 변경</Text>
      </View>

      <View style={styles.formCard}>
        <AppTextField label="이름" value={formData.name} onChangeText={(value) => setFormData((prev) => ({ ...prev, name: value }))} />
        <AppTextField label="닉네임" value={formData.nickname} onChangeText={(value) => setFormData((prev) => ({ ...prev, nickname: value }))} />
        <AppTextField label="전화번호" value={formData.phone} onChangeText={(value) => setFormData((prev) => ({ ...prev, phone: value }))} />
        <AppTextField label="이메일" value={formData.email} onChangeText={(value) => setFormData((prev) => ({ ...prev, email: value }))} />
        <AppTextField
          label="자기소개"
          multiline
          value={formData.bio}
          onChangeText={(value) => setFormData((prev) => ({ ...prev, bio: value }))}
        />
        <AppButton
          label="저장하기"
          onPress={async () => {
            const result = await updateProfile(formData);
            if (result.error) {
              Alert.alert('저장 실패', result.error);
              return;
            }
            router.back();
          }}
        />
      </View>
    </AppScreen>
  );
}

export function MyLocationScreen() {
  const { user, updateLocation } = useAppContext();
  const [city, setCity] = useState(user?.location.city ?? '서울시');
  const [neighborhood, setNeighborhood] = useState(user?.location.neighborhood ?? '');
  const [selectedLocation, setSelectedLocation] = useState<NeighborhoodLocation | null>(user?.location ?? null);

  const results = useMemo(() => searchLocations(neighborhoodOptions, city, neighborhood), [city, neighborhood]);

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="내 동네 설정" />
      <View style={styles.formCard}>
        <Text style={styles.sectionText}>주소를 `OO시 OO동` 형태로 입력하고, 기본 범위 5km를 유지합니다.</Text>
        <AppTextField label="시/도" value={city} onChangeText={setCity} placeholder="예: 서울시" />
        <AppTextField label="동" value={neighborhood} onChangeText={setNeighborhood} placeholder="예: 역삼동" />
      </View>
      <View style={styles.locationTip}>
        <Ionicons name="walk-outline" size={18} color={colors.brand} />
        <Text style={styles.tipText}>현재 동네 범위는 5km입니다.</Text>
      </View>

      <View style={styles.resultList}>
        {results.map((location) => {
          const active = selectedLocation?.id === location.id;
          return (
            <Pressable
              key={location.id}
              onPress={() => setSelectedLocation(location)}
              style={[styles.locationCard, active && styles.locationCardActive]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.locationCardTitle, active && { color: colors.brand }]}>{location.fullAddress}</Text>
                <Text style={styles.chatTime}>반경 {location.radiusKm}km</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : null}
            </Pressable>
          );
        })}
      </View>

      <AppButton
        label="저장하기"
        onPress={async () => {
          if (selectedLocation) {
            const result = await updateLocation(selectedLocation);
            if (result.error) {
              Alert.alert('저장 실패', result.error);
              return;
            }
            router.back();
          }
        }}
      />
    </AppScreen>
  );
}

export function MyStatsScreen() {
  const { authToken } = useAppContext();
  const [period, setPeriod] = useState<'3months' | '6months' | 'year'>('6months');
  const [stats, setStats] = useState<MypageStats>({
    period: '6months',
    myAverage: 0,
    allAverage: 0,
    difference: 0,
    monthlyStats: [],
  });

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      const result = await mypageAPI.stats(period, authToken ?? undefined);
      if (mounted && result.data) {
        setStats(result.data);
      }
    }

    loadStats();
    return () => {
      mounted = false;
    };
  }, [authToken, period]);

  const currentData = stats.monthlyStats;
  const averageMine = stats.myAverage.toFixed(1);
  const averageAll = stats.allAverage.toFixed(1);

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="나눔통계" />
      <View style={styles.segmentedRow}>
        {[
          ['3months', '3개월'],
          ['6months', '6개월'],
          ['year', '1년'],
        ].map(([value, label]) => {
          const active = period === value;
          return (
            <Pressable
              key={value}
              onPress={() => setPeriod(value as '3months' | '6months' | 'year')}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}>
              <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsSummary}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{averageMine}회</Text>
          <Text style={styles.statLabel}>내 월평균</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{averageAll}회</Text>
          <Text style={styles.statLabel}>전체 평균</Text>
        </View>
      </View>

      <View style={styles.highlightPanel}>
        <Text style={styles.highlightPanelTitle}>평균 대비 {(Number(averageMine) - Number(averageAll)).toFixed(1)}회</Text>
        <Text style={styles.highlightPanelText}>평균보다 더 많이 나눔하고 계세요. 좋은 흐름을 계속 이어가고 있어요.</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>월별 나눔 비교</Text>
        {currentData.map((item) => (
          <View key={item.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFillMine, { width: `${item.mine * 14}%` }]} />
              <View style={[styles.barFillAvg, { width: `${item.avg * 14}%` }]} />
            </View>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

export function MySharesScreen() {
  const { authToken } = useAppContext();
  const [selectedItem, setSelectedItem] = useState<ShareHistoryItem | null>(null);
  const [histories, setHistories] = useState<ShareHistoryItem[]>(mockShareHistory);

  useEffect(() => {
    let mounted = true;

    async function loadHistories() {
      const result = await mypageAPI.histories(authToken ?? undefined);
      if (mounted && result.data.length) {
        setHistories(result.data);
      }
    }

    loadHistories();
    return () => {
      mounted = false;
    };
  }, [authToken]);

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="나의 나눔/활동" />

      <View style={styles.highlightPanel}>
        <Text style={styles.highlightPanelTitle}>총 활동 {histories.length}회</Text>
        <Text style={styles.highlightPanelText}>여러분의 작은 나눔이 누군가에게 큰 힘이 되고 있어요.</Text>
      </View>

      <View style={styles.resultList}>
        {histories.map((item) => (
          <Pressable
            key={item.id}
            style={styles.shareCard}
            onPress={() => {
              if (item.status === 'completed' && item.review) {
                setSelectedItem(item);
              } else {
                router.push(`/post/${item.id}`);
              }
            }}>
            <Image source={{ uri: item.image }} style={styles.shareImage} contentFit="cover" />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={styles.chatTopRow}>
                <Text style={styles.chatName}>{item.title}</Text>
                <View style={[styles.statusBadge, item.status === 'completed' && { backgroundColor: colors.successSoft }]}>
                  <Text style={[styles.statusBadgeText, item.status === 'completed' && { color: colors.success }]}>
                    {item.status === 'completed' ? '나눔완료' : '진행중'}
                  </Text>
                </View>
              </View>
              <Text style={styles.chatTime}>{item.date}</Text>
              {item.review ? <Text style={styles.reviewLink}>후기 보기</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>

      <AppModal visible={Boolean(selectedItem)} onClose={() => setSelectedItem(null)}>
        {selectedItem?.review ? (
          <>
            <Text style={styles.modalTitle}>감사 메시지</Text>
            <Text style={styles.sectionText}>{selectedItem.review.from}님이 남긴 후기입니다.</Text>
            <View style={styles.reviewBubble}>
              <Text style={styles.reviewStars}>{'★'.repeat(selectedItem.review.rating)}</Text>
              <Text style={styles.sectionText}>{selectedItem.review.message}</Text>
            </View>
            <AppButton label="닫기" onPress={() => setSelectedItem(null)} />
          </>
        ) : null}
      </AppModal>
    </AppScreen>
  );
}

export function SettingsScreen() {
  const { logout } = useAppContext();
  const [notifications, setNotifications] = useState({
    push: true,
    newPost: true,
    chat: true,
    activity: false,
  });

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="설정" />
      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>알림 설정</Text>
        {[
          ['push', '푸시 알림', '모든 알림 받기'],
          ['newPost', '새 게시글 알림', '내 동네에 새 게시글이 올라올 때'],
          ['chat', '채팅 알림', '새로운 메시지가 도착할 때'],
          ['activity', '활동 알림', '예약, 완료 등 상태 변경'],
        ].map(([key, title, description]) => (
          <View key={key} style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{title}</Text>
              <Text style={styles.chatTime}>{description}</Text>
            </View>
            <Switch
              value={notifications[key as keyof typeof notifications]}
              onValueChange={(value) =>
                setNotifications((prev) => ({ ...prev, [key]: value }))
              }
            />
          </View>
        ))}
      </View>

      <View style={styles.menuCard}>
        <MenuRow icon="lock-closed-outline" label="비밀번호 변경" onPress={() => Alert.alert('안내', '추후 백엔드와 연동됩니다.')} />
        <MenuRow icon="document-text-outline" label="서비스 이용약관" onPress={() => Alert.alert('안내', '정책 문서는 추후 연결됩니다.')} />
        <MenuRow icon="help-circle-outline" label="자주 묻는 질문" onPress={() => Alert.alert('안내', 'FAQ는 추후 연결됩니다.')} />
      </View>

      <AppButton
        label="로그아웃"
        variant="danger"
        onPress={() => {
          logout();
          router.replace('/login');
        }}
      />
    </AppScreen>
  );
}

export function ContactAdminScreen() {
  const { authToken } = useAppContext();
  const [formData, setFormData] = useState({
    subject: '',
    email: '',
    message: '',
  });

  return (
    <AppScreen scroll contentContainerStyle={styles.pageContent}>
      <AppHeader title="관리자에게 문의하기" />
      <View style={styles.formCard}>
        <AppTextField label="제목" value={formData.subject} onChangeText={(value) => setFormData((prev) => ({ ...prev, subject: value }))} />
        <AppTextField
          label="연락받을 이메일"
          value={formData.email}
          onChangeText={(value) => setFormData((prev) => ({ ...prev, email: value }))}
        />
        <AppTextField
          label="문의 내용"
          multiline
          value={formData.message}
          onChangeText={(value) => setFormData((prev) => ({ ...prev, message: value }))}
        />
        <View style={styles.locationTip}>
          <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
          <Text style={styles.tipText}>평일 09:00 ~ 18:00 기준 1~2일 내에 답변드립니다.</Text>
        </View>
        <AppButton
          label="문의하기"
          onPress={async () => {
            const result = await mypageAPI.contact(formData, authToken ?? undefined);
            if (result.error) {
              Alert.alert('문의 실패', result.error);
              return;
            }
            Alert.alert('문의 접수', '문의가 접수되었습니다.');
            router.back();
          }}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  profileCard: {
    alignItems: 'center',
    gap: 10,
    padding: 22,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  profileAvatarLarge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  profileNickname: {
    fontSize: 14,
    color: colors.brand,
    fontWeight: '700',
  },
  profileLocation: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statsSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.brand,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  menuCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  formCard: {
    gap: 16,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  locationTip: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: colors.brand,
    fontWeight: '600',
  },
  resultList: {
    gap: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  locationCardActive: {
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  locationCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.brand,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentButtonTextActive: {
    color: '#fff',
  },
  highlightPanel: {
    gap: 8,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
  },
  highlightPanelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  highlightPanelText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#dbeafe',
  },
  chartCard: {
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  barRow: {
    gap: 8,
  },
  barLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  barTrack: {
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFillMine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brand,
    borderRadius: 8,
  },
  barFillAvg: {
    position: 'absolute',
    left: 0,
    top: 5,
    bottom: 5,
    backgroundColor: colors.accent,
    borderRadius: 8,
    opacity: 0.8,
  },
  shareCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  shareImage: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  reviewLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  reviewBubble: {
    gap: 10,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
  },
  reviewStars: {
    fontSize: 18,
    color: '#f59e0b',
  },
  settingsCard: {
    gap: 14,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
