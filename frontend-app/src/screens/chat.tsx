import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";

import { AppButton } from "@/src/components/common/AppButton";
import { AppHeader } from "@/src/components/common/AppHeader";
import { KakaoMapPreview } from "@/src/components/common/KakaoMapPreview";
import { AppModal } from "@/src/components/common/AppModal";
import { AppScreen } from "@/src/components/common/AppScreen";
import { AppTextField } from "@/src/components/common/AppTextField";
import { useAppContext } from "@/src/context/AppContext";
import { reviewAPI } from "@/src/services/api";
import { colors, radius, spacing } from "@/src/theme/colors";
import { NeighborhoodLocation } from "@/src/types/app";
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
  const { authToken, chatRooms, messagesByChat, posts, sendMessage, user } =
    useAppContext();
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [meetingPlaceOpen, setMeetingPlaceOpen] = useState(false);
  const [meetingPlace, setMeetingPlace] = useState<NeighborhoodLocation | null>(null);
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
  const [isLeaving, setIsLeaving] = useState(false);

  const chatRoom = useMemo(
    () => chatRooms.find((item) => item.id === id) ?? null,
    [chatRooms, id],
  );
  const relatedPost = useMemo(
    () =>
      chatRoom?.postId
        ? (posts.find((item) => item.id === chatRoom.postId) ?? null)
        : null,
    [chatRoom, posts],
  );
  const messages = chatRoom ? (messagesByChat[chatRoom.id] ?? []) : [];
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth],
  );
  const handleShareLocation = () => {
    setPlusOpen(false);
    Alert.alert(
      "위치 공유 준비 중",
      "실시간 위치 공유는 아직 연결 전이라 약속장소 정하기를 사용해주세요.",
    );
  };

  const handleSchedulePlace = async () => {
    if (!user?.location) {
      Alert.alert(
        "내 위치가 필요합니다",
        "마이페이지에서 내 동네를 먼저 설정해주세요.",
      );
      return;
    }

    setPlusOpen(false);
    setMeetingPlace(user.location);
    setMeetingPlaceOpen(true);
  };

  const sendMeetingPlace = async () => {
    if (!meetingPlace) {
      Alert.alert("약속장소를 선택해주세요");
      return;
    }

    setIsSendingMeetingPlace(true);
    const locationLabel = formatLocationLabel(meetingPlace);
    const result = await sendMessage(
      chatRoom?.id ?? "",
      [
        `약속장소 제안: ${locationLabel}`,
        `날짜: ${formatMeetingDate(meetingDate)}`,
        `시간: ${formatMeetingTime(meetingHour, meetingMinute)}`,
        `좌표: ${meetingPlace.latitude.toFixed(6)}, ${meetingPlace.longitude.toFixed(6)}`,
      ].join("\n"),
    );
    setIsSendingMeetingPlace(false);

    if (result.error) {
      Alert.alert("약속장소 전송 실패", result.error);
      return;
    }

    setMeetingPlaceOpen(false);
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
        subtitle={`${chatRoom.userLocation} · 매너온도 ${chatRoom.mannerTemperature}°C`}
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

      <ScrollView
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item, index) => (
          <View
            key={`${item.id ?? item.messageId ?? "message"}-${index}`}
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
        ))}
      </ScrollView>

      <View style={styles.chatComposer}>
        <Pressable
          style={styles.composerIcon}
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
          onPress={() => {
            setMenuOpen(false);
            setRatingOpen(true);
          }}
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
                      await fetch(
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
                    } catch {
                      // 네트워크 오류가 발생해도 화면은 채팅 목록으로 이동
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

      <AppModal visible={plusOpen} onClose={() => setPlusOpen(false)}>
        <Text style={styles.modalTitle}>추가 기능</Text>

        <View style={styles.plusGrid}>
          <Pressable
            style={styles.plusAction}
            onPress={() => Alert.alert("안내", "사진 기능은 추후 연동됩니다.")}
          >
            <Ionicons name="image-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>사진</Text>
          </Pressable>

          <Pressable
            style={styles.plusAction}
            onPress={() =>
              Alert.alert("안내", "카메라 기능은 추후 연동됩니다.")
            }
          >
            <Ionicons name="camera-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>카메라</Text>
          </Pressable>

          <Pressable style={styles.plusAction} onPress={handleShareLocation}>
            <Ionicons name="location-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>위치 공유</Text>
          </Pressable>

          <Pressable style={styles.plusAction} onPress={handleSchedulePlace}>
            <Ionicons name="calendar-outline" size={24} color={colors.brand} />
            <Text style={styles.plusActionText}>약속장소</Text>
          </Pressable>
        </View>

        <AppButton label="닫기" onPress={() => setPlusOpen(false)} />
      </AppModal>

      <AppModal
        visible={meetingPlaceOpen}
        onClose={() => setMeetingPlaceOpen(false)}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.meetingModalContent}
        >
          <Text style={styles.modalTitle}>약속장소 정하기</Text>
          <Text style={styles.sectionText}>
            지도를 누르거나 마커를 움직여 만날 위치를 정해주세요.
          </Text>
        <KakaoMapPreview
          location={meetingPlace}
          onLocationChange={setMeetingPlace}
          moveMarkerOnMapInteraction
          moveMarkerOnMapDragEnd={false}
        />
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
              onPress={() => setMeetingPlaceOpen(false)}
              style={{ flex: 1 }}
            />
            <AppButton
              label="약속장소 보내기"
              onPress={sendMeetingPlace}
              loading={isSendingMeetingPlace}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
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
          <Text style={styles.profileStatLine}>
            매너온도: {chatRoom.mannerTemperature}°C
          </Text>
          <Text style={styles.profileStatLine}>나눔 횟수: 23회</Text>
          <Text style={styles.profileStatLine}>응답률: 95%</Text>
        </View>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>받은 후기</Text>
          <Text style={styles.sectionText}>
            {'"친절하시고 시간 약속도 잘 지켜주셨어요."'}
          </Text>
        </View>
        <AppButton label="닫기" onPress={() => setProfileOpen(false)} />
      </AppModal>

      <AppModal visible={ratingOpen} onClose={() => setRatingOpen(false)}>
        <Text style={styles.modalTitle}>매너 평가하기</Text>
        <Text style={styles.sectionText}>
          거래 경험을 남겨주시면 상대방의 신뢰도에 도움이 됩니다.
        </Text>
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
        />
        <View style={styles.modalButtonRow}>
          <AppButton
            label="취소"
            variant="secondary"
            onPress={() => setRatingOpen(false)}
            style={{ flex: 1 }}
          />
          <AppButton
            label="평가하기"
            disabled={!ratingType || isReviewing}
            onPress={async () => {
              if (!user) {
                Alert.alert("로그인이 필요합니다");
                return;
              }

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

              if (result.error) {
                Alert.alert("평가 실패", result.error);
                return;
              }

              Alert.alert("평가 완료", "평가가 저장되었습니다.");
              setRatingOpen(false);
              setRatingType(null);
              setRatingComment("");
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
