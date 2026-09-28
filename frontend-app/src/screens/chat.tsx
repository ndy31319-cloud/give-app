import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Location from 'expo-location';
import { captureImage, pickImageFromLibrary } from '@/src/utils/imagePicker';
import { ChatAttachment, TradeRequest, NeighborhoodLocation } from '@/src/types/app';
import { tradeAPI } from '@/src/services/tradeApi';
import { router, useLocalSearchParams } from "expo-router";

import { AppButton } from "@/src/components/common/AppButton";
import { TradeRequestCard } from "@/src/components/common/TradeRequestCard";
import { AppHeader } from "@/src/components/common/AppHeader";
import { KakaoMapPreview } from "@/src/components/common/KakaoMapPreview";
import { AppModal } from "@/src/components/common/AppModal";
import { AppScreen } from "@/src/components/common/AppScreen";
import { AppTextField } from "@/src/components/common/AppTextField";
import { useAppContext } from "@/src/context/AppContext";
import { reviewAPI } from "@/src/services/api";
import { loadReviewStatus, ReviewStatus } from '@/src/services/reviewApi';
import { MemberReputation } from '@/src/components/common/MemberReputation';
import { colors, radius, spacing } from "@/src/theme/colors";
import { formatLocationLabel } from "@/src/utils/location";

const meetingHours = Array.from({ length: 24 }, (_, index) => index);
const meetingMinutes = [0, 10, 20, 30, 40, 50];
const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMeetingDate(date: Date) {
  const weekday = weekdayLabels[date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

function formatMeetingTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseMeetingPlaceMessage(text: string) {
  const lines = text.split("\n").map((line) => line.trim());
  const placeLine = lines.find((line) => line.startsWith("약속장소 제안:"));
  const dateLine = lines.find((line) => line.startsWith("날짜:"));
  const timeLine = lines.find((line) => line.startsWith("시간:"));
  const coordLine = lines.find((line) => line.startsWith("좌표:"));

  if (!placeLine || !coordLine) {
    return null;
  }

  const [latitudeText, longitudeText] = coordLine
    .replace("좌표:", "")
    .split(",")
    .map((value) => value.trim());
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    place: placeLine.replace("약속장소 제안:", "").trim(),
    date: dateLine?.replace("날짜:", "").trim() ?? "",
    time: timeLine?.replace("시간:", "").trim() ?? "",
    latitude,
    longitude,
  };
}

function buildKakaoPlaceUrl(place: string, latitude: number, longitude: number) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(place)},${latitude},${longitude}`;
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const days: (Date | null)[] = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

export function ChatListScreen() {
  const { chatRooms } = useAppContext();

  return (
    <AppScreen>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>채팅</Text>
        <Text style={styles.listSubtitle}>
          나눔 진행 상황을 빠르게 확인해보세요.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {chatRooms.map((chat, index) => (
          <Pressable
            key={`${chat.id}-${index}`}
            onPress={() => router.push(`/chat/${chat.id}`)}
            style={styles.chatRow}
          >
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
  const { authToken, chatRooms, messagesByChat, posts, sendMessage, sendAttachment, user, applyTrade, openChatRoom } =
    useAppContext();
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [meetingPlaceOpen, setMeetingPlaceOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<TradeRequest | null>(null);
  const [meetingLabel, setMeetingLabel] = useState('');
  const meetingLock = useRef(false);
  const [meetingPlace, setMeetingPlace] = useState<NeighborhoodLocation | null>(null);
  const [viewingMeetingPlace, setViewingMeetingPlace] = useState<ReturnType<
    typeof parseMeetingPlaceMessage
  > | null>(null);
  const [meetingDate, setMeetingDate] = useState(() => startOfDay(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [meetingHour, setMeetingHour] = useState(14);
  const [meetingMinute, setMeetingMinute] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingType, setRatingType] = useState<"positive" | "negative" | null>(
    null,
  );
  const [ratingComment, setRatingComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSendingMeetingPlace, setIsSendingMeetingPlace] = useState(false);
  const sendingRef = useRef(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const reviewLock = useRef(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const reviewStatusVersion = useRef(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const attachmentLock = useRef(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const pendingPlusAction = useRef<(() => void) | null>(null);
  const runAfterPlusCloses = (action: () => void) => {
    if (Platform.OS === 'ios') {
      pendingPlusAction.current = action;
      setPlusOpen(false);
    } else {
      setPlusOpen(false);
      action();
    }
  };
  const finishPlusDismiss = () => {
    const action = pendingPlusAction.current;
    pendingPlusAction.current = null;
    action?.();
  };

  const newMessageId = () => `attachment_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  async function selectPhoto(camera: boolean) {
    if (attachmentLock.current) return;
    attachmentLock.current = true;
    setAttachmentBusy(true);
    setPlusOpen(false);
    try {
      const image = await (camera ? captureImage() : pickImageFromLibrary());
      if (!image) return;
      if (image.size && image.size > 5 * 1024 * 1024) {
        Alert.alert('사진 크기 초과', '5MB 이하의 사진을 선택해주세요.');
        return;
      }
      setAttachment({ type: 'IMAGE', image, clientMessageId: newMessageId() });
    } catch {
      Alert.alert(camera ? '카메라를 열 수 없습니다' : '사진을 불러올 수 없습니다', '기기 권한을 확인한 뒤 다시 시도해주세요.');
    } finally { attachmentLock.current = false; setAttachmentBusy(false); }
  }

  async function sendSelectedAttachment() {
    if (!attachment || !chatRoom || attachmentLock.current) return;
    attachmentLock.current = true;
    setAttachmentBusy(true);
    try {
      const result = await sendAttachment(chatRoom.id, attachment);
      if (result.error) Alert.alert('전송 실패', result.error);
      else setAttachment(null);
    } finally { attachmentLock.current = false; setAttachmentBusy(false); }
  }

  const chatRoom = useMemo(
    () => chatRooms.find((item) => item.id === id) ?? null,
    [chatRooms, id],
  );
  const relatedPost = useMemo(
    () =>
      chatRoom?.postId
        ? (posts.find((item) => item.id === chatRoom.postId) ?? null)
        : null,
    [chatRoom?.postId, posts],
  );
  const messages = chatRoom ? (messagesByChat[chatRoom.id] ?? []) : [];
  const roomTrade = messages.find(item => item.tradeRequest)?.tradeRequest;
  async function openReview() {
    setMenuOpen(false); setRatingOpen(true); setReviewStatus(null); setReviewError(null);
    setRatingType(null); setRatingComment('');
    const version = ++reviewStatusVersion.current;
    const result = await loadReviewStatus(String(id), authToken ?? undefined);
    if (version === reviewStatusVersion.current) { setReviewStatus(result.data); setReviewError(result.error); }
  }
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const handleShareLocation = async () => {
    if (attachmentLock.current) return;
    attachmentLock.current = true;
    setAttachmentBusy(true);
    setPlusOpen(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('위치 권한이 필요합니다', '기기 설정에서 위치 접근을 허용해주세요.');
        return;
      }
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), 15000); }),
      ]);
      setAttachment({ type: 'LOCATION', clientMessageId: newMessageId(), location: {
        latitude: current.coords.latitude, longitude: current.coords.longitude, label: '공유한 현재 위치',
      } });
    } catch {
      Alert.alert('위치를 확인하지 못했습니다', '기기의 위치 기능을 켜고 다시 시도해주세요.');
    } finally {
      if (timeout) clearTimeout(timeout);
      attachmentLock.current = false;
      setAttachmentBusy(false);
    }
  };

  const handleSchedulePlace = async (knownTrade?: TradeRequest) => {
    setPlusOpen(false);
    const tradeId = knownTrade?.id || roomTrade?.id;
    const result = tradeId ? await tradeAPI.get(tradeId, authToken ?? undefined) : null;
    if (result?.error) { Alert.alert('약속 조회 실패', result.error); return; }
    const approvedTrade = result?.data?.status === 'approved' ? result.data : null;
    setEditingTrade(approvedTrade);
    const previous = approvedTrade?.appointment?.pending || approvedTrade?.appointment?.confirmed;
    const date = previous && new Date(previous.at).getTime() > Date.now() ? new Date(previous.at) : new Date(Date.now() + 86400000);
    setMeetingDate(startOfDay(date)); setCalendarMonth(startOfDay(date));
    setMeetingHour(date.getHours()); setMeetingMinute(Math.floor(date.getMinutes() / 10) * 10);
    setMeetingLabel(previous?.place || '');
    setMeetingPlace(previous?.latitude != null && previous.longitude != null ? { id: 'appointment', city: '', district: '', neighborhood: '', dongName: '', fullAddress: previous.place, radiusKm: 1, latitude: previous.latitude, longitude: previous.longitude } : null);
    setMeetingPlaceOpen(true);
  };

  const sendMeetingPlace = async () => {
    if (!chatRoom || meetingLock.current) return;
    if (!meetingLabel.trim() && !meetingPlace) {
      Alert.alert("약속장소를 입력하거나 지도에서 선택해주세요");
      return;
    }
    const at = new Date(meetingDate); at.setHours(meetingHour, meetingMinute, 0, 0);
    if (at.getTime() <= Date.now()) { Alert.alert('시간 확인', '현재보다 이후 시간을 선택해주세요.'); return; }
    meetingLock.current = true;
    setIsSendingMeetingPlace(true);
    try {
    if (!editingTrade) {
      if (!meetingPlace) { Alert.alert('약속장소 선택', '지도에서 만날 위치를 선택해주세요.'); return; }
      const result = await sendMessage(chatRoom.id, [
        `약속장소 제안: ${meetingLabel.trim() || formatLocationLabel(meetingPlace)}`,
        `날짜: ${formatMeetingDate(meetingDate)}`,
        `시간: ${formatMeetingTime(meetingHour, meetingMinute)}`,
        `좌표: ${meetingPlace.latitude.toFixed(6)}, ${meetingPlace.longitude.toFixed(6)}`,
      ].join('\n'));
      if (result.error) { Alert.alert('약속 제안 실패', result.error); return; }
      setMeetingPlaceOpen(false);
      return;
    }
    const result = await tradeAPI.proposeAppointment(editingTrade.id, { revision: editingTrade.appointment?.revision || 0, at: at.toISOString(), place: meetingLabel.trim() || formatLocationLabel(meetingPlace!), latitude: meetingPlace?.latitude ?? null, longitude: meetingPlace?.longitude ?? null }, authToken ?? undefined);

    if (result.error) {
      Alert.alert("약속 제안 실패", result.error);
      setMeetingPlaceOpen(false);
      const latest = await tradeAPI.get(editingTrade.id, authToken ?? undefined);
      if (latest.data) applyTrade(latest.data);
      return;
    }

    setMeetingPlaceOpen(false);
    if (result.data) applyTrade(result.data);
    } catch {
      Alert.alert('약속 제안 실패', '서버 연결을 확인하고 다시 시도해주세요.');
    } finally {
      meetingLock.current = false;
      setIsSendingMeetingPlace(false);
    }
  };

  if (!chatRoom) {
    return (
      <AppScreen>
        <AppHeader title="채팅방" />
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>채팅방을 찾을 수 없습니다.</Text>
          <Text style={styles.listSubtitle}>
            게시글에서 다시 채팅을 시작해주세요.
          </Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <AppButton
            label="채팅 목록으로"
            onPress={() => router.replace("/chat")}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title={chatRoom.userName}
        subtitle={`${chatRoom.userLocation} · 마음 점수 ${chatRoom.mannerTemperature.toFixed(1)}점`}
        onTitlePress={() => setProfileOpen(true)}
        right={
          <Pressable
            style={styles.headerMenuButton}
            onPress={() => setMenuOpen(true)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        }
      />

      {relatedPost ? (
        <View style={styles.profileStrip}>
          <Pressable
            style={styles.relatedPostButton}
            onPress={() => router.push(`/post/${relatedPost.id}`)}
          >
            {relatedPost.images[0] ? (
              <Image
                source={{ uri: relatedPost.images[0] }}
                style={styles.relatedPostImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.relatedPostPlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={colors.textLight}
                />
              </View>
            )}
            <View style={styles.relatedPostMeta}>
              <Text
                style={[
                  styles.relatedPostType,
                  relatedPost.type === "share"
                    ? styles.relatedPostTypeShare
                    : styles.relatedPostTypeNeed,
                ]}
              >
                {relatedPost.type === "share" ? "나눔해요" : "필요해요"}
              </Text>
              <Text style={styles.relatedPostTitle} numberOfLines={2}>
                {relatedPost.title}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {roomTrade && <ScrollView style={{ maxHeight: 280, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
        <TradeRequestCard request={roomTrade} onSchedule={trade => void handleSchedulePlace(trade)} onReview={() => void openReview()} />
      </ScrollView>}
      <ScrollView
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item, index) => {
          if (item.tradeRequest) {
            return null;
          }
          if (item.image?.url) {
            return <View key={item.id} style={[styles.meetingMessageWrap, item.sender === 'me' ? styles.meetingMessageMine : styles.meetingMessageOther]}>
              <Pressable accessibilityLabel="사진 크게 보기" onPress={() => setViewingImage(item.image!.url)}>
                <Image source={{ uri: item.image.url }} style={{ width: 230, height: 230, borderRadius: radius.md }} contentFit="cover" />
              </Pressable>
              <Text style={styles.messageTime}>{item.timeLabel}</Text>
            </View>;
          }
          if (item.location) {
            const location = item.location;
            return <View key={item.id} style={[styles.meetingMessageWrap, item.sender === 'me' ? styles.meetingMessageMine : styles.meetingMessageOther]}>
              <Pressable style={styles.meetingMessageCard} onPress={() => setViewingMeetingPlace({
                place: location.label, latitude: location.latitude, longitude: location.longitude, date: '', time: '',
              })}>
                <Ionicons name="location" size={24} color={colors.brand} />
                <View style={styles.meetingMessageBody}>
                  <Text style={styles.meetingMessageTitle}>현재 위치 공유</Text>
                  <Text style={styles.meetingMessageMeta}>눌러서 지도 보기</Text>
                </View>
              </Pressable>
              <Text style={styles.messageTime}>{item.timeLabel}</Text>
            </View>;
          }
          const meeting = parseMeetingPlaceMessage(item.text);

          if (meeting) {
            return (
              <View
                key={`${item.id}-${index}`}
                style={[
                  styles.meetingMessageWrap,
                  item.sender === "me"
                    ? styles.meetingMessageMine
                    : styles.meetingMessageOther,
                ]}
              >
                <Pressable
                  style={styles.meetingMessageCard}
                  onPress={() => setViewingMeetingPlace(meeting)}
                >
                  <View style={styles.meetingMessageIcon}>
                    <Ionicons name="location" size={18} color={colors.brand} />
                  </View>
                  <View style={styles.meetingMessageBody}>
                    <Text style={styles.meetingMessageLabel}>약속장소</Text>
                    <Text style={styles.meetingMessageTitle} numberOfLines={2}>
                      {meeting.place}
                    </Text>
                    <Text style={styles.meetingMessageMeta}>
                      {[meeting.date, meeting.time].filter(Boolean).join(" ")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textLight}
                  />
                </Pressable>
                <Text style={styles.meetingMessageHint}>
                  눌러서 약속장소 보기
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    item.sender === "me" && styles.messageTimeMine,
                  ]}
                >
                  {item.timeLabel}
                </Text>
              </View>
            );
          }

          return (
            <View
              key={`${item.id}-${index}`}
              style={[
                styles.messageBubble,
                item.sender === "me" ? styles.messageMine : styles.messageOther,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  item.sender === "me" && styles.messageTextMine,
                ]}
              >
                {item.text}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  item.sender === "me" && styles.messageTimeMine,
                ]}
              >
                {item.timeLabel}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {attachmentBusy && !attachment && <Text style={styles.meetingMessageHint}>첨부 내용을 준비하고 있어요…</Text>}
      <View style={styles.chatComposer}>
        <Pressable
          style={styles.composerIcon}
          disabled={attachmentBusy}
          onPress={() => setPlusOpen(true)}
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppTextField
            value={message}
            onChangeText={setMessage}
            placeholder="메시지를 입력하세요"
          />
        </View>
        <Pressable
          style={[
            styles.sendButton,
            (!message.trim() || isSending) && { opacity: 0.4 },
          ]}
          disabled={!message.trim() || isSending}
          onPress={async () => {
            const draft = message.trim();

            if (!draft) {
              return;
            }

            if (sendingRef.current) {
              return;
            }

            sendingRef.current = true;
            setIsSending(true);
            setMessage("");

            try {
              const result = await sendMessage(chatRoom.id, draft);

              if (result.error) {
                Alert.alert("전송 실패", result.error);
                setMessage(draft);
                return;
              }
            } catch (error) {
              console.log("메시지 전송 오류:", error);
              Alert.alert("전송 실패", "메시지 전송 중 오류가 발생했습니다.");
              setMessage(draft);
            } finally {
              sendingRef.current = false;
              setIsSending(false);
            }
          }}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      <AppModal visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.modalTitle}>채팅방 메뉴</Text>

        <Pressable
          disabled={isLeaving}
          style={[styles.menuAction, isLeaving && { opacity: 0.5 }]}
          onPress={() => void openReview()}
        >
          <Ionicons name="thumbs-up-outline" size={20} color={colors.brand} />
          <Text style={styles.menuActionText}>매너 평가하기</Text>
        </Pressable>

        <Pressable
          style={styles.menuAction}
          onPress={() =>
            Alert.alert("신고 접수", "신고 기능은 추후 백엔드와 연동됩니다.")
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={colors.danger}
          />
          <Text style={styles.menuActionText}>신고하기</Text>
        </Pressable>

        <Pressable
          style={styles.menuAction}
          onPress={() => Alert.alert("안내", "차단 기능은 추후 연동됩니다.")}
        >
          <Ionicons name="ban-outline" size={20} color={colors.textMuted} />
          <Text style={styles.menuActionText}>차단하기</Text>
        </Pressable>

        <Pressable
          style={styles.menuAction}
          onPress={() => {
            setMenuOpen(false);

            Alert.alert(
              "채팅방 나가기",
              "채팅방을 나가시겠습니까?\n나가면 대화 내용을 볼 수 없습니다.",
              [
                {
                  text: "취소",
                  style: "cancel",
                },
                {
                  text: "나가기",
                  style: "destructive",
                  onPress: async () => {
                    setIsLeaving(true);

                    try {
                      const response = await fetch(
                        `${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "")}/api/chats/rooms/${chatRoom.id}`,
                        {
                          method: "DELETE",
                          headers: authToken
                            ? {
                                Authorization: `Bearer ${authToken}`,
                                Accept: "application/json",
                              }
                            : {
                                Accept: "application/json",
                              },
                        },
                      );
                      if (!response.ok) {
                        const body = await response.json().catch(() => null);
                        Alert.alert('나가기 실패', body?.message || '잠시 후 다시 시도해주세요.');
                        return;
                      }
                    } catch {
                      Alert.alert('나가기 실패', '서버에 연결할 수 없습니다.');
                      return;
                    } finally {
                      setIsLeaving(false);
                    }

                    router.replace("/(tabs)/chat");
                  },
                },
              ],
            );
          }}
        >
          <Ionicons name="exit-outline" size={20} color={colors.danger} />
          <Text style={[styles.menuActionText, { color: colors.danger }]}>
            {isLeaving ? "나가는 중" : "채팅방 나가기"}
          </Text>
        </Pressable>

        <AppButton label="닫기" onPress={() => setMenuOpen(false)} />
      </AppModal>

      <AppModal visible={plusOpen} onClose={() => setPlusOpen(false)} onDismiss={finishPlusDismiss}>
        <Text style={styles.modalTitle}>추가 기능</Text>

        <View style={styles.plusGrid}>
          <Pressable
            style={styles.plusAction}
            disabled={attachmentBusy}
            onPress={() => runAfterPlusCloses(() => void selectPhoto(false))}
          >
            <Ionicons name="image-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>사진</Text>
          </Pressable>

          <Pressable
            style={styles.plusAction}
            disabled={attachmentBusy}
            onPress={() => runAfterPlusCloses(() => void selectPhoto(true))}
          >
            <Ionicons name="camera-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>카메라</Text>
          </Pressable>

          <Pressable style={styles.plusAction} disabled={attachmentBusy} onPress={() => runAfterPlusCloses(() => void handleShareLocation())}>
            <Ionicons name="location-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>위치 공유</Text>
          </Pressable>

          <Pressable style={styles.plusAction} onPress={() => runAfterPlusCloses(() => void handleSchedulePlace())}>
            <Ionicons name="calendar-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>약속장소</Text>
          </Pressable>
        </View>

        <AppButton label="닫기" onPress={() => setPlusOpen(false)} />
      </AppModal>

      <AppModal visible={attachment !== null} onClose={() => { if (!attachmentBusy) setAttachment(null); }}>
        <Text style={styles.modalTitle}>{attachment?.type === 'IMAGE' ? '사진 보내기' : '현재 위치 보내기'}</Text>
        {attachment?.type === 'IMAGE' && <Image source={{ uri: attachment.image.uri }} style={{ width: '100%', height: 300 }} contentFit="contain" />}
        {attachment?.type === 'LOCATION' && <>
          <Text style={styles.sectionText}>이 위치를 채팅 상대에게 한 번 공유합니다.</Text>
          <Text style={styles.meetingPlaceCoords}>{attachment.location.latitude.toFixed(6)}, {attachment.location.longitude.toFixed(6)}</Text>
          <KakaoMapPreview location={{ ...attachment.location, id: 'current_share', city: '', district: '', neighborhood: '', dongName: '', fullAddress: '현재 위치', radiusKm: 1 }}
            showCurrentLocation initialCurrentPosition={attachment.location} showSelectedMarker={false} initializeSelectionFromCurrentLocation={false}
            onLocationChange={() => undefined} moveMarkerOnMapInteraction={false} moveMarkerOnMapDragEnd={false} />
        </>}
        <View style={styles.modalButtonRow}>
          <AppButton label="취소" variant="secondary" disabled={attachmentBusy} onPress={() => setAttachment(null)} style={{ flex: 1 }} />
          <AppButton label="보내기" loading={attachmentBusy} onPress={() => void sendSelectedAttachment()} style={{ flex: 1 }} />
        </View>
      </AppModal>

      <AppModal visible={viewingImage !== null} onClose={() => setViewingImage(null)}>
        <Text style={styles.modalTitle}>사진</Text>
        {viewingImage && <Image source={{ uri: viewingImage }} style={{ width: '100%', height: 400 }} contentFit="contain" />}
        <AppButton label="닫기" onPress={() => setViewingImage(null)} />
      </AppModal>

      <AppModal
        visible={meetingPlaceOpen}
        onClose={() => { if (!meetingLock.current) setMeetingPlaceOpen(false); }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.meetingModalContent}
        >
          <Text style={styles.modalTitle}>{editingTrade?.appointment?.confirmed ? '약속 변경 제안' : '만날 약속 정하기'}</Text>
          <Text style={styles.sectionText}>{editingTrade ? '상대방이 확인하면 확정돼요.' : '선택한 장소와 시간을 채팅으로 보내요.'} 시간은 기기에 설정된 시간대 기준입니다.</Text>
          <AppTextField label="만날 장소" placeholder="예: 학교 정문 앞 벤치" value={meetingLabel} maxLength={200} onChangeText={value => { setMeetingLabel(value); setMeetingPlace(null); }} />
          <Text style={styles.sectionText}>
            파란 점은 내 위치예요. 지도를 누르거나 핀을 움직여 만날 위치를 정해주세요.
          </Text>
        {meetingPlaceOpen && <KakaoMapPreview
          location={meetingPlace}
          onLocationChange={place => { setMeetingPlace(place); setMeetingLabel(formatLocationLabel(place)); }}
          showCurrentLocation
          initializeSelectionFromCurrentLocation={!editingTrade?.appointment?.pending && !editingTrade?.appointment?.confirmed}
          moveMarkerOnMapInteraction
          moveMarkerOnMapDragEnd={false}
        />}
          {meetingPlace ? (
            <View style={styles.meetingPlaceSummary}>
              <Ionicons name="location" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetingPlaceTitle}>
                  {formatLocationLabel(meetingPlace)}
                </Text>
                <Text style={styles.meetingPlaceCoords}>
                  {meetingPlace.latitude.toFixed(6)},{" "}
                  {meetingPlace.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.meetingPickerCard}>
            <View style={styles.calendarHeader}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.calendarTitle}>
                {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
              </Text>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() =>
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.weekdayRow}>
              {weekdayLabels.map((weekday) => (
                <Text key={weekday} style={styles.weekdayText}>
                  {weekday}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const active = day ? isSameDate(day, meetingDate) : false;
                const disabled = day ? startOfDay(day) < startOfDay(new Date()) : true;

                return (
                  <Pressable
                    key={day?.toISOString() ?? `blank-${index}`}
                    disabled={!day || disabled}
                    onPress={() => day && setMeetingDate(day)}
                    style={[
                      styles.calendarDay,
                      active && styles.calendarDayActive,
                      disabled && styles.calendarDayDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        active && styles.calendarDayTextActive,
                        disabled && styles.calendarDayTextDisabled,
                      ]}
                    >
                      {day ? day.getDate() : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.meetingPickerCard}>
            <Text style={styles.meetingPickerTitle}>시간</Text>
            <View style={styles.timePickerRow}>
              <ScrollView
                style={styles.timeWheel}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {meetingHours.map((hour) => {
                  const active = hour === meetingHour;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => setMeetingHour(hour)}
                      style={[styles.timeOption, active && styles.timeOptionActive]}
                    >
                      <Text style={[styles.timeOptionText, active && styles.timeOptionTextActive]}>
                        {String(hour).padStart(2, "0")}시
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                style={styles.timeWheel}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {meetingMinutes.map((minute) => {
                  const active = minute === meetingMinute;
                  return (
                    <Pressable
                      key={minute}
                      onPress={() => setMeetingMinute(minute)}
                      style={[styles.timeOption, active && styles.timeOptionActive]}
                    >
                      <Text style={[styles.timeOptionText, active && styles.timeOptionTextActive]}>
                        {String(minute).padStart(2, "0")}분
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={styles.meetingSelectedText}>
              {formatMeetingDate(meetingDate)} {formatMeetingTime(meetingHour, meetingMinute)}
            </Text>
          </View>

          <View style={styles.modalButtonRow}>
            <AppButton
              label="취소"
              variant="secondary"
              disabled={isSendingMeetingPlace}
              onPress={() => setMeetingPlaceOpen(false)}
              style={{ flex: 1 }}
            />
            <AppButton
              label="약속 제안 보내기"
              onPress={sendMeetingPlace}
              loading={isSendingMeetingPlace}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={Boolean(viewingMeetingPlace)}
        onClose={() => setViewingMeetingPlace(null)}
      >
        {viewingMeetingPlace ? (
          <View style={styles.meetingModalContent}>
            <Text style={styles.modalTitle}>약속장소</Text>
            <View style={styles.meetingPlaceSummary}>
              <Ionicons name="location" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.meetingPlaceTitle}>
                  {viewingMeetingPlace.place}
                </Text>
                <Text style={styles.meetingPlaceCoords}>
                  {[viewingMeetingPlace.date, viewingMeetingPlace.time]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              </View>
            </View>
            <KakaoMapPreview
              location={{
                id: "shared_meeting_place",
                city: "",
                district: "",
                neighborhood: viewingMeetingPlace.place,
                dongName: viewingMeetingPlace.place,
                fullAddress: viewingMeetingPlace.place,
                latitude: viewingMeetingPlace.latitude,
                longitude: viewingMeetingPlace.longitude,
                radiusKm: 5,
              }}
              onLocationChange={() => undefined}
              moveMarkerOnMapInteraction={false}
              moveMarkerOnMapDragEnd={false}
            />
            <View style={styles.modalButtonRow}>
              <AppButton
                label="닫기"
                variant="secondary"
                onPress={() => setViewingMeetingPlace(null)}
                style={{ flex: 1 }}
              />
              <AppButton
                label="카카오맵 열기"
                onPress={() =>
                  Linking.openURL(
                    buildKakaoPlaceUrl(
                      viewingMeetingPlace.place,
                      viewingMeetingPlace.latitude,
                      viewingMeetingPlace.longitude,
                    ),
                  )
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}
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
        {profileOpen && <ScrollView style={{ flexShrink: 1 }}><MemberReputation memberId={chatRoom.userId} /></ScrollView>}
        <AppButton label="닫기" onPress={() => setProfileOpen(false)} />
      </AppModal>

      <AppModal visible={ratingOpen} onClose={() => { if (!reviewLock.current) { reviewStatusVersion.current++; setRatingOpen(false); } }}>
        <Text style={styles.modalTitle}>매너 평가하기</Text>
        <Text style={styles.sectionText}>
          거래 경험을 남겨주시면 상대방의 신뢰도에 도움이 됩니다.
        </Text>
        <Text style={styles.sectionText}>매너있어요 +0.5점 · 아쉬워요 −0.5점 · 거래당 한 번 평가할 수 있어요.</Text>
        {reviewError ? <AppButton label={`${reviewError} · 다시 확인`} variant="secondary" onPress={() => void openReview()} /> : !reviewStatus ? <Text style={styles.sectionText}>작성 가능 여부를 확인하고 있어요…</Text> : !reviewStatus.canReview ? <Text style={styles.sectionText}>{reviewStatus.reason}</Text> : null}
        {reviewStatus?.canReview && <>
        <View style={styles.ratingRow}>
          <Pressable
            style={[
              styles.ratingCard,
              ratingType === "positive" && styles.ratingCardPositive,
            ]}
            onPress={() => setRatingType("positive")}
          >
            <Ionicons
              name="thumbs-up"
              size={24}
              color={
                ratingType === "positive" ? colors.success : colors.textLight
              }
            />
            <Text style={styles.ratingLabel}>매너있어요</Text>
          </Pressable>
          <Pressable
            style={[
              styles.ratingCard,
              ratingType === "negative" && styles.ratingCardNegative,
            ]}
            onPress={() => setRatingType("negative")}
          >
            <Ionicons
              name="thumbs-down"
              size={24}
              color={
                ratingType === "negative" ? colors.accent : colors.textLight
              }
            />
            <Text style={styles.ratingLabel}>아쉬워요</Text>
          </Pressable>
        </View>
        <AppTextField
          multiline
          value={ratingComment}
          onChangeText={setRatingComment}
          placeholder="거래 경험을 알려주세요"
          maxLength={500}
          editable={!isReviewing}
        />
        <View style={styles.modalButtonRow}>
          <AppButton
            label="취소"
            variant="secondary"
            disabled={isReviewing}
            onPress={() => setRatingOpen(false)}
            style={{ flex: 1 }}
          />
          <AppButton
            label="평가하기"
            disabled={!ratingType || isReviewing || !reviewStatus?.canReview}
            onPress={async () => {
              if (!user) {
                Alert.alert("로그인이 필요합니다");
                return;
              }

              if (reviewLock.current || !reviewStatus?.canReview) return;
              reviewLock.current = true;
              setIsReviewing(true);
              const result = await reviewAPI.create({
                roomId: chatRoom.id,
                donateId: String(chatRoom.postId ?? ""),
                writerId: user.id,
                targetMemberId: chatRoom.userId,
                rating: ratingType === "positive" ? 5 : 2,
                content:
                  ratingComment.trim() ||
                  (ratingType === "positive"
                    ? "좋은 거래였습니다."
                    : "아쉬운 거래였습니다."),
                authToken: authToken ?? undefined,
              });
              setIsReviewing(false);
              reviewLock.current = false;

              if (result.error) {
                Alert.alert("평가 실패", result.error);
                const latest = await loadReviewStatus(chatRoom.id, authToken ?? undefined);
                setReviewStatus(latest.data); setReviewError(latest.error);
                return;
              }

              Alert.alert("평가 완료", "평가가 저장되었습니다.");
              setRatingOpen(false);
              setRatingType(null);
              setRatingComment("");
              await openChatRoom(chatRoom.id);
            }}
            style={{ flex: 1 }}
          />
        </View>
        </>}
        {!reviewStatus?.canReview && <AppButton label="닫기" variant="secondary" onPress={() => { reviewStatusVersion.current++; setRatingOpen(false); }} />}
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
    fontWeight: "800",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "700",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
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
    width: "56%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  relatedPostMeta: {
    flex: 1,
    gap: 4,
  },
  relatedPostType: {
    fontSize: 11,
    fontWeight: "700",
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
    fontWeight: "700",
    color: colors.text,
  },
  messageList: {
    padding: spacing.lg,
    gap: 10,
    paddingBottom: 100,
  },
  messageBubble: {
    maxWidth: "76%",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  messageMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.brand,
  },
  messageOther: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMine: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    color: colors.textLight,
  },
  messageTimeMine: {
    color: "#dbeafe",
  },
  meetingMessageWrap: {
    maxWidth: "86%",
    gap: 6,
  },
  meetingMessageMine: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  meetingMessageOther: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  meetingMessageCard: {
    width: 270,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  meetingMessageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSoft,
  },
  meetingMessageBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  meetingMessageLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
  },
  meetingMessageTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: colors.text,
  },
  meetingMessageMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  meetingMessageHint: {
    fontSize: 11,
    color: colors.textLight,
  },
  chatComposer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  composerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  menuActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  plusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  plusAction: {
    width: "47%",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  plusActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  meetingModalContent: {
    gap: 14,
    paddingBottom: 6,
  },
  meetingPlaceSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  meetingPlaceTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  meetingPlaceCoords: {
    fontSize: 12,
    color: colors.textMuted,
  },
  meetingPickerCard: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  meetingPickerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  calendarDay: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayActive: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  calendarDayDisabled: {
    opacity: 0.32,
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  calendarDayTextActive: {
    color: "#fff",
  },
  calendarDayTextDisabled: {
    color: colors.textLight,
  },
  timePickerRow: {
    flexDirection: "row",
    gap: 10,
  },
  timeWheel: {
    flex: 1,
    maxHeight: 132,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  timeOption: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  timeOptionActive: {
    backgroundColor: colors.brandSoft,
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  timeOptionTextActive: {
    color: colors.brand,
  },
  meetingSelectedText: {
    paddingVertical: 8,
    borderRadius: radius.md,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand,
    backgroundColor: colors.surface,
  },
  profileCard: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
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
    fontWeight: "700",
    color: colors.brand,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 12,
  },
  ratingCard: {
    flex: 1,
    alignItems: "center",
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
    fontWeight: "700",
    color: colors.text,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
});
