import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Post } from "@/src/types/app";
import { colors, radius } from "@/src/theme/colors";
import { formatTimeAgo } from "@/src/utils/time";
import { haversineDistanceKm } from "@/src/utils/location";
import { getPostStatusLabel, isOpenPostStatus } from "@/src/utils/post";

interface PostCardProps {
  post: Post;
  currentLocation?: Post["location"];
  currentUserId?: string;
  onPress: () => void;
}

export function PostCard({
  post,
  currentLocation,
  currentUserId,
  onPress,
}: PostCardProps) {
  const distance = currentLocation
    ? haversineDistanceKm(currentLocation, post.location)
    : null;
  const completed = post.status === "completed";
  const statusLabel = getPostStatusLabel(post.status);

  const isMyPost = currentUserId
    ? String(post.author?.id) === String(currentUserId)
    : false;
  const shouldShowDistance = !isMyPost && distance !== null && Number.isFinite(distance);

  const badgeLabel = isMyPost
    ? "내가 쓴 글"
    : post.type === "share"
      ? "나눔해요"
      : "필요해요";
  const isKioskRequest = post.type === 'need' && post.createdFrom === 'web';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        completed && styles.completedCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.content, completed && styles.completedContent]}>
        {post.images[0] ? (
          <Image
            source={{ uri: post.images[0] }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={24} color={colors.textLight} />
          </View>
        )}
        <View style={styles.main}>
          <View style={styles.row}>
            <View
              style={[
                styles.badge,
                isMyPost
                  ? styles.myPostBadge
                  : post.type === "share"
                    ? styles.shareBadge
                    : styles.needBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isMyPost
                    ? styles.myPostBadgeText
                    : post.type === "need" && styles.needBadgeText,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>
            {!isOpenPostStatus(post.status) && statusLabel ? (
              <View
                style={[styles.statusBadge, completed && styles.completedBadge]}
              >
                <Text
                  style={[
                    styles.statusText,
                    completed && styles.completedStatusText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[styles.title, completed && styles.completedTitle]}
            numberOfLines={2}
          >
            {post.title}
          </Text>
          {isKioskRequest ? <Text style={styles.kioskNotice}>키오스크에서 작성된 요청글입니다.</Text> : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.metaText}>{post.location.neighborhood}</Text>
            </View>
            {shouldShowDistance ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name="walk-outline"
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.metaText}>{distance}km</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.metaText}>
                {formatTimeAgo(post.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completedCard: {
    backgroundColor: colors.surfaceMuted,
  },
  completedContent: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.96,
  },
  content: {
    flexDirection: "row",
    gap: 12,
  },
  main: {
    flex: 1,
    gap: 8,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  shareBadge: {
    backgroundColor: colors.brandSoft,
  },
  needBadge: {
    backgroundColor: colors.accentSoft,
  },
  myPostBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  needBadgeText: {
    color: colors.accent,
  },
  myPostBadgeText: {
    color: colors.text,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
  },
  completedBadge: {
    backgroundColor: colors.border,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  completedStatusText: {
    color: colors.textMuted,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },
  kioskNotice: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  completedTitle: {
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
});
