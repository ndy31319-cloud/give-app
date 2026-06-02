import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppModal } from '@/src/components/common/AppModal';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { useAppContext } from '@/src/context/AppContext';
import { reviewAPI } from '@/src/services/api';
import { colors, radius, spacing } from '@/src/theme/colors';
import { NeighborhoodLocation } from '@/src/types/app';
import { formatLocationLabel } from '@/src/utils/location';

function buildKakaoMapLinks(location: NeighborhoodLocation) {
  const label = encodeURIComponent(formatLocationLabel(location));
  const latitude = location.latitude;
  const longitude = location.longitude;

  return {
    app: `kakaomap://look?p=${latitude},${longitude}`,
    web: `https://map.kakao.com/link/map/${label},${latitude},${longitude}`,
  };
}

async function openKakaoMap(location: NeighborhoodLocation) {
  const links = buildKakaoMapLinks(location);

  try {
    const canOpenKakaoMap = await Linking.canOpenURL(links.app);
    await Linking.openURL(canOpenKakaoMap ? links.app : links.web);
  } catch {
    await Linking.openURL(links.web);
  }
}

export function ChatListScreen() {
  const { chatRooms } = useAppContext();

  return (
    <AppScreen>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>채팅</Text>
        <Text style={styles.listSubtitle}>나눔 진행 상황을 빠르게 확인해보세요.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {chatRooms.map((chat) => (
          <Pressable key={chat.id} onPress={() => router.push(`/chat/${chat.id}`)} style={styles.chatRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.chatTopRow}>
                <Text style={styles.chatName}>{chat.userName}</Text>
                <Text style={styles.chatTime}>{chat.timeLabel}</Text>
              </View>
              <Text style={styles.chatPreview} numberOfLines={1}>
                {chat.lastMessage}
              </Text>
            </View>
            {chat.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

export function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authToken, chatRooms, messagesByChat, posts, sendMessage, user } = useAppContext();
  const [message, setMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingType, setRatingType] = useState<'positive' | 'negative' | null>(null);
  const [ratingComment, setRatingComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const chatRoom = useMemo(() => chatRooms.find((item) => item.id === id) ?? null, [chatRooms, id]);
  const relatedPost = useMemo(
    () => (chatRoom?.postId ? posts.find((item) => item.id === chatRoom.postId) ?? null : null),
    [chatRoom?.postId, posts],
  );
  const messages = chatRoom ? messagesByChat[chatRoom.id] ?? [] : [];
  const handleShareLocation = async () => {
    if (!user?.location) {
      Alert.alert('내 위치가 필요합니다', '마이페이지에서 내 동네를 먼저 설정해주세요.');
      return;
    }

    setPlusOpen(false);
    const locationLabel = formatLocationLabel(user.location);
    const links = buildKakaoMapLinks(user.location);
    const result = await sendMessage(chatRoom?.id ?? '', `위치 공유: ${locationLabel}\n카카오맵: ${links.web}`);

    if (result.error) {
      Alert.alert('위치 공유 실패', result.error);
      return;
    }

    await openKakaoMap(user.location);
  };

  if (!chatRoom) {
    return (
      <AppScreen>
        <AppHeader title="채팅방" />
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>채팅방을 찾을 수 없습니다.</Text>
          <Text style={styles.listSubtitle}>게시글에서 다시 채팅을 시작해주세요.</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <AppButton label="채팅 목록으로" onPress={() => router.replace('/chat')} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title={chatRoom.userName}
        subtitle={`${chatRoom.userLocation} · 매너온도 ${chatRoom.mannerTemperature}°C`}
        onTitlePress={() => setProfileOpen(true)}
        right={
          <Pressable style={styles.headerMenuButton} onPress={() => setMenuOpen(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        }
      />

      {relatedPost ? (
        <View style={styles.profileStrip}>
          <Pressable style={styles.relatedPostButton} onPress={() => router.push(`/post/${relatedPost.id}`)}>
            {relatedPost.images[0] ? (
              <Image source={{ uri: relatedPost.images[0] }} style={styles.relatedPostImage} contentFit="cover" />
            ) : (
              <View style={styles.relatedPostPlaceholder}>
                <Ionicons name="image-outline" size={20} color={colors.textLight} />
              </View>
            )}
            <View style={styles.relatedPostMeta}>
              <Text
                style={[
                  styles.relatedPostType,
                  relatedPost.type === 'share' ? styles.relatedPostTypeShare : styles.relatedPostTypeNeed,
                ]}>
                {relatedPost.type === 'share' ? '나눔해요' : '필요해요'}
              </Text>
              <Text style={styles.relatedPostTitle} numberOfLines={2}>
                {relatedPost.title}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {messages.map((item) => (
          <View key={item.id} style={[styles.messageBubble, item.sender === 'me' ? styles.messageMine : styles.messageOther]}>
            <Text style={[styles.messageText, item.sender === 'me' && styles.messageTextMine]}>{item.text}</Text>
            <Text style={[styles.messageTime, item.sender === 'me' && styles.messageTimeMine]}>{item.timeLabel}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.chatComposer}>
        <Pressable style={styles.composerIcon} onPress={() => setPlusOpen(true)}>
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppTextField value={message} onChangeText={setMessage} placeholder="메시지를 입력하세요" />
        </View>
        <Pressable
          style={[styles.sendButton, (!message.trim() || isSending) && { opacity: 0.4 }]}
          onPress={async () => {
            const draft = message;
            setIsSending(true);
            const result = await sendMessage(chatRoom.id, draft);
            setIsSending(false);
            if (result.error) {
              Alert.alert('전송 실패', result.error);
              return;
            }
            setMessage('');
          }}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      <AppModal visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.modalTitle}>채팅방 메뉴</Text>
        <Pressable
          style={styles.menuAction}
          onPress={() => {
            setMenuOpen(false);
            setRatingOpen(true);
          }}>
          <Ionicons name="thumbs-up-outline" size={20} color={colors.brand} />
          <Text style={styles.menuActionText}>매너 평가하기</Text>
        </Pressable>
        <Pressable style={styles.menuAction} onPress={() => Alert.alert('신고 접수', '신고 기능은 추후 백엔드와 연동됩니다.')}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={styles.menuActionText}>신고하기</Text>
        </Pressable>
        <Pressable style={styles.menuAction} onPress={() => Alert.alert('안내', '차단 기능은 추후 연동됩니다.')}>
          <Ionicons name="ban-outline" size={20} color={colors.textMuted} />
          <Text style={styles.menuActionText}>차단하기</Text>
        </Pressable>
        <AppButton label="닫기" onPress={() => setMenuOpen(false)} />
      </AppModal>

      <AppModal visible={plusOpen} onClose={() => setPlusOpen(false)}>
        <Text style={styles.modalTitle}>추가 기능</Text>
        <View style={styles.plusGrid}>
          <Pressable style={styles.plusAction} onPress={() => Alert.alert('안내', '사진 기능은 추후 연동됩니다.')}>
            <Ionicons name="image-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>사진</Text>
          </Pressable>
          <Pressable style={styles.plusAction} onPress={() => Alert.alert('안내', '카메라 기능은 추후 연동됩니다.')}>
            <Ionicons name="camera-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>카메라</Text>
          </Pressable>
          <Pressable style={styles.plusAction} onPress={handleShareLocation}>
            <Ionicons name="location-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>위치 공유</Text>
          </Pressable>
          <Pressable style={styles.plusAction} onPress={handleShareLocation}>
            <Ionicons name="calendar-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>약속장소</Text>
          </Pressable>
        </View>
        <AppButton label="닫기" onPress={() => setPlusOpen(false)} />
      </AppModal>

      <AppModal visible={profileOpen} onClose={() => setProfileOpen(false)}>
        <Text style={styles.modalTitle}>프로필 정보</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={34} color={colors.textMuted} />
          </View>
          <Text style={styles.profileName}>{chatRoom.userName}</Text>
          <Text style={styles.chatTime}>{chatRoom.userLocation}</Text>
        </View>
        <View style={styles.profileStats}>
          <Text style={styles.profileStatLine}>매너온도: {chatRoom.mannerTemperature}°C</Text>
          <Text style={styles.profileStatLine}>나눔 횟수: 23회</Text>
          <Text style={styles.profileStatLine}>응답률: 95%</Text>
        </View>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>받은 후기</Text>
          <Text style={styles.sectionText}>{'"친절하시고 시간 약속도 잘 지켜주셨어요."'}</Text>
        </View>
        <AppButton label="닫기" onPress={() => setProfileOpen(false)} />
      </AppModal>

      <AppModal visible={ratingOpen} onClose={() => setRatingOpen(false)}>
        <Text style={styles.modalTitle}>매너 평가하기</Text>
        <Text style={styles.sectionText}>거래 경험을 남겨주시면 상대방의 신뢰도에 도움이 됩니다.</Text>
        <View style={styles.ratingRow}>
          <Pressable
            style={[styles.ratingCard, ratingType === 'positive' && styles.ratingCardPositive]}
            onPress={() => setRatingType('positive')}>
            <Ionicons name="thumbs-up" size={24} color={ratingType === 'positive' ? colors.success : colors.textLight} />
            <Text style={styles.ratingLabel}>매너있어요</Text>
          </Pressable>
          <Pressable
            style={[styles.ratingCard, ratingType === 'negative' && styles.ratingCardNegative]}
            onPress={() => setRatingType('negative')}>
            <Ionicons name="thumbs-down" size={24} color={ratingType === 'negative' ? colors.accent : colors.textLight} />
            <Text style={styles.ratingLabel}>아쉬워요</Text>
          </Pressable>
        </View>
        <AppTextField
          multiline
          value={ratingComment}
          onChangeText={setRatingComment}
          placeholder="거래 경험을 알려주세요"
        />
        <View style={styles.modalButtonRow}>
          <AppButton label="취소" variant="secondary" onPress={() => setRatingOpen(false)} style={{ flex: 1 }} />
          <AppButton
            label="평가하기"
            disabled={!ratingType || isReviewing}
            onPress={async () => {
              if (!user) {
                Alert.alert('로그인이 필요합니다');
                return;
              }

              setIsReviewing(true);
              const result = await reviewAPI.create({
                roomId: chatRoom.id,
                donateId: String(chatRoom.postId ?? ''),
                writerId: user.id,
                targetMemberId: chatRoom.userId,
                rating: ratingType === 'positive' ? 5 : 2,
                content: ratingComment.trim() || (ratingType === 'positive' ? '좋은 거래였습니다.' : '아쉬운 거래였습니다.'),
                authToken: authToken ?? undefined,
              });
              setIsReviewing(false);

              if (result.error) {
                Alert.alert('평가 실패', result.error);
                return;
              }

              Alert.alert('평가 완료', '평가가 저장되었습니다.');
              setRatingOpen(false);
              setRatingType(null);
              setRatingComment('');
            }}
            style={{ flex: 1 }}
          />
        </View>
      </AppModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 10,
    gap: 6,
  },
  listTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  listSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    gap: 12,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chatPreview: {
    fontSize: 14,
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  profileStrip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  relatedPostButton: {
    width: '56%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  relatedPostImage: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  relatedPostPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  relatedPostMeta: {
    flex: 1,
    gap: 4,
  },
  relatedPostType: {
    fontSize: 11,
    fontWeight: '700',
  },
  relatedPostTypeShare: {
    color: colors.brand,
  },
  relatedPostTypeNeed: {
    color: colors.accent,
  },
  relatedPostTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.text,
  },
  messageList: {
    padding: spacing.lg,
    gap: 10,
    paddingBottom: 100,
  },
  messageBubble: {
    maxWidth: '76%',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: colors.textLight,
  },
  messageTimeMine: {
    color: '#dbeafe',
  },
  chatComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  composerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  menuAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  menuActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  plusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  plusAction: {
    width: '47%',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  plusActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  profileCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  profileStats: {
    gap: 8,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  profileStatLine: {
    fontSize: 14,
    color: colors.text,
  },
  reviewCard: {
    gap: 8,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ratingCardPositive: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  ratingCardNegative: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
