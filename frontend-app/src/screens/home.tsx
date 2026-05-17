import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/src/components/common/AppButton';
import { AppHeader } from '@/src/components/common/AppHeader';
import { AppModal } from '@/src/components/common/AppModal';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { PostCard } from '@/src/components/common/PostCard';
import { useAppContext } from '@/src/context/AppContext';
import { categoryOptions, createMockUser } from '@/src/data/mockData';
import { postAPI } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import { styles } from '@/src/screens/home.styles';
import { ImageAnalysisResult, SearchFilters, UploadableImage } from '@/src/types/app';
import { captureImage, pickImageFromLibrary } from '@/src/utils/imagePicker';
import {
  filterPostsByRadius,
  formatCompactLocation,
  formatLocationLabel,
} from '@/src/utils/location';
import { getPostStatusLabel, isOpenPostStatus } from '@/src/utils/post';
import { formatTimeAgo } from '@/src/utils/time';
import { validateRequired } from '@/src/utils/validation';

function isBeneficiaryUser(user?: { isVulnerable?: boolean; roleCode?: string; vulnerableTypes?: string[] } | null) {
  return Boolean(user && (user.isVulnerable || user.roleCode === 'BENEFICIARY' || user.vulnerableTypes?.length));
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

function SearchSourceModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (source: 'camera' | 'gallery') => void;
}) {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>사진 선택</Text>
      <Text style={styles.modalDescription}>카메라로 찍거나 갤러리에서 사진을 가져올 수 있습니다.</Text>
      <AppButton label="갤러리에서 가져오기" onPress={() => onSelect('gallery')} />
      <AppButton label="카메라로 촬영하기" variant="secondary" onPress={() => onSelect('camera')} />
    </AppModal>
  );
}

function FilterModal({
  visible,
  onClose,
  filters,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Text style={styles.modalTitle}>검색 필터</Text>
      <Text style={styles.modalDescription}>원하는 조건으로 검색 결과를 좁혀보세요.</Text>

      <SectionTitle title="게시글 유형" />
      <View style={styles.optionGroup}>
        {[
          { value: 'all', label: '전체' },
          { value: 'share', label: '나눔해요' },
          { value: 'need', label: '필요해요' },
        ].map((item) => (
          <Pressable
            key={item.value}
            onPress={() => onChange({ ...filters, type: item.value as SearchFilters['type'] })}
            style={[styles.optionButton, filters.type === item.value && styles.optionButtonActive]}>
            <Text style={[styles.optionLabel, filters.type === item.value && styles.optionLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="상태" />
      <View style={styles.optionGroup}>
        {[
          { value: 'all', label: '전체' },
          { value: 'open', label: '나눔 가능' },
          { value: 'reserved', label: '예약중' },
          { value: 'completed', label: '완료' },
        ].map((item) => (
          <Pressable
            key={item.value}
            onPress={() => onChange({ ...filters, status: item.value as SearchFilters['status'] })}
            style={[styles.optionButton, filters.status === item.value && styles.optionButtonActive]}>
            <Text style={[styles.optionLabel, filters.status === item.value && styles.optionLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="동네 범위" description="기본값은 5km입니다." />
      <View style={styles.optionGroup}>
        {[1, 3, 5, 10].map((distanceKm) => (
          <Pressable
            key={distanceKm}
            onPress={() => onChange({ ...filters, distanceKm })}
            style={[styles.optionButton, filters.distanceKm === distanceKm && styles.optionButtonActive]}>
            <Text style={[styles.optionLabel, filters.distanceKm === distanceKm && styles.optionLabelActive]}>
              {distanceKm}km 이내
            </Text>
          </Pressable>
        ))}
      </View>

      <AppButton label="닫기" onPress={onClose} />
    </AppModal>
  );
}

function pickLabelForAnalysis(analysis: ImageAnalysisResult | null) {
  if (!analysis) return 'AI 분석 전';
  if (analysis.isHarmful) return '유해 가능';
  return `AI 인식: ${analysis.detectedItem}`;
}

function showUnexpectedError(title = '오류가 발생했습니다') {
  Alert.alert(title, '잠시 후 다시 시도해주세요.');
}

async function pickImage(source: 'camera' | 'gallery') {
  return source === 'camera' ? captureImage() : pickImageFromLibrary();
}

export function HomeScreen() {
  const { user, posts } = useAppContext();
  const previewLocation = useMemo(() => createMockUser().location, []);
  const allowedHomePostType = user ? (isBeneficiaryUser(user) ? 'share' : 'need') : 'all';
  const homeFeed = useMemo(() => {
    const baseLocation = user?.location ?? previewLocation;
    const radiusKm = user?.location.radiusKm ?? previewLocation.radiusKm;
    const nearbyPosts = filterPostsByRadius(posts, baseLocation, radiusKm).filter((post) =>
      allowedHomePostType === 'all' ? true : post.type === allowedHomePostType,
    );
    const fallbackPosts = posts.filter((post) =>
      allowedHomePostType === 'all' ? true : post.type === allowedHomePostType,
    );

    return {
      location: baseLocation,
      radiusKm,
      posts: nearbyPosts.length > 0 ? nearbyPosts : fallbackPosts,
      isPreviewMode: !user || nearbyPosts.length === 0,
    };
  }, [allowedHomePostType, posts, previewLocation, user]);

  return (
    <AppScreen>
      <View style={styles.homeHeaderArea}>
        <View style={styles.homeTop}>
          <View style={styles.headerCard}>
            <Pressable style={styles.locationButton} onPress={() => router.push('/my-location')}>
              <Ionicons name="location" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>
                  {user ? formatCompactLocation(user.location) : `${formatCompactLocation(homeFeed.location)} 미리보기`}
                </Text>
                <Text style={styles.locationSubtitle}>
                  {user
                    ? `동네 반경 ${user.location.radiusKm}km`
                    : `첫 화면 샘플 더미데이터 · 반경 ${homeFeed.radiusKm}km`}
                </Text>
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable style={styles.headerIcon} onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.homeSearchBar} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <Text style={styles.homeSearchText}>찾고 싶은 물품을 검색해보세요</Text>
            <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.feedContainer}>
        <ScrollView
          style={styles.feedScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {homeFeed.isPreviewMode ? (
            <View style={styles.previewBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
              <Text style={styles.previewBannerText}>
                {user
                  ? isBeneficiaryUser(user)
                    ? '취약계층 회원에게는 나눔해요 게시글만 보여주고 있어요.'
                    : '일반회원에게는 필요해요 게시글만 보여주고 있어요.'
                  : '첫 홈 화면에서는 샘플 더미데이터를 먼저 보여주고 있어요.'}
              </Text>
            </View>
          ) : null}

          {homeFeed.posts.length > 0 ? (
            homeFeed.posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentLocation={homeFeed.location}
                onPress={() => router.push(`/post/${post.id}`)}
              />
            ))
          ) : (
            <View style={styles.homeEmptyState}>
              <Ionicons name="document-text-outline" size={28} color={colors.textLight} />
              <Text style={styles.homeEmptyStateTitle}>표시할 게시글이 아직 없어요.</Text>
              <Text style={styles.homeEmptyStateDescription}>첫 글을 등록해서 홈 화면을 채워보세요.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <Pressable style={styles.floatingButton} onPress={() => router.push('/write')}>
        <Ionicons name="create-outline" size={24} color="#fff" />
        <Text style={styles.floatingButtonText}>글쓰기</Text>
      </Pressable>
    </AppScreen>
  );
}

export function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { posts, startChatWithPost, user } = useAppContext();
  const [isStartingChat, setIsStartingChat] = useState(false);
  const post = posts.find((item) => item.id === id);

  async function handleStartChat() {
    if (!post || isStartingChat) {
      return;
    }

    setIsStartingChat(true);
    const result = await startChatWithPost(post);
    setIsStartingChat(false);

    if (result.error || !result.roomId) {
      Alert.alert('채팅 연결 실패', result.error ?? '채팅방을 열 수 없습니다.');
      return;
    }

    router.push(`/chat/${result.roomId}`);
  }

  if (!post) {
    return (
      <AppScreen>
        <AppHeader title="게시글 상세" />
        <View style={styles.homeEmptyState}>
          <Ionicons name="document-text-outline" size={28} color={colors.textLight} />
          <Text style={styles.homeEmptyStateTitle}>게시글을 찾을 수 없습니다.</Text>
          <Text style={styles.homeEmptyStateDescription}>목록에서 다시 선택해주세요.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll contentContainerStyle={{ paddingBottom: 110 }}>
      <AppHeader
        title="게시글 상세"
        right={
          <Pressable style={styles.headerIcon}>
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
          </Pressable>
        }
      />

      {post.images[0] ? <Image source={{ uri: post.images[0] }} style={styles.detailImage} contentFit="cover" /> : null}

      <View style={styles.detailContent}>
        <View style={styles.authorRow}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={26} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.author.name}</Text>
            <Text style={styles.metaMuted}>
              {post.location.neighborhood} · 매너온도 {post.author.temperature.toFixed(1)}°C
            </Text>
          </View>
        </View>

        <View style={styles.rowWrap}>
          <View style={[styles.inlineBadge, post.type === 'share' ? styles.shareBadge : styles.needBadge]}>
            <Text style={[styles.badgeText, post.type === 'need' && styles.needBadgeText]}>
              {post.type === 'share' ? '나눔해요' : '필요해요'}
            </Text>
          </View>
          {!isOpenPostStatus(post.status) ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{getPostStatusLabel(post.status)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.detailTitle}>{post.title}</Text>
        <Text style={styles.detailDescription}>{post.description}</Text>

        <View style={styles.metaCard}>
          <View style={styles.metaLine}>
            <Ionicons name="location-outline" size={18} color={colors.brand} />
            <Text style={styles.metaLineText}>{formatLocationLabel(post.location)}</Text>
          </View>
          <View style={styles.metaLine}>
            <Ionicons name="time-outline" size={18} color={colors.brand} />
            <Text style={styles.metaLineText}>{formatTimeAgo(post.createdAt)}</Text>
          </View>
          {user ? (
            <View style={styles.metaLine}>
              <Ionicons name="walk-outline" size={18} color={colors.brand} />
              <Text style={styles.metaLineText}>내 동네 기준 반경 {user.location.radiusKm}km 내 게시글</Text>
            </View>
          ) : null}
        </View>

        {post.status === 'reserved' ? (
          <View style={styles.warningCard}>
            <Ionicons name="time" size={18} color={colors.warning} />
            <Text style={styles.warningText}>이 게시글은 현재 예약중입니다.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomActions}>
        <AppButton
          label={isStartingChat ? '연결 중' : '채팅하기'}
          variant="secondary"
          disabled={isStartingChat}
          onPress={handleStartChat}
          style={{ flex: 1 }}
        />
        <AppButton
          label={post.type === 'share' ? '나눔 신청' : '나눔하기'}
          onPress={() => Alert.alert('안내', '이 기능은 채팅 연결 중심으로 이어집니다.')}
          style={{ flex: 1 }}
        />
      </View>
    </AppScreen>
  );
}

export function NotificationsScreen() {
  const { notifications, markNotificationRead } = useAppContext();

  return (
    <AppScreen>
      <AppHeader title="알림" />
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {notifications.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => markNotificationRead(item.id)}
            style={[styles.notificationCard, !item.isRead && styles.notificationUnread]}>
            <View style={styles.notificationIcon}>
              <Ionicons
                name={item.type === 'chat' ? 'chatbubble-ellipses-outline' : item.type === 'share' ? 'gift-outline' : 'information-circle-outline'}
                size={22}
                color={item.type === 'share' ? colors.success : colors.brand}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.notificationTopRow}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.sectionDescription}>{item.message}</Text>
              <Text style={styles.notificationTime}>{item.timeLabel}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

export function WriteEntryScreen() {
  const { user } = useAppContext();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    const nextType = isBeneficiaryUser(user) ? 'need' : 'share';
    router.replace(`/write/form?type=${nextType}`);
  }, [user]);

  return (
    <AppScreen scroll contentContainerStyle={styles.writeSelectContent}>
      <AppHeader title="글쓰기" />
      <View style={styles.centerCard}>
        <Text style={styles.centerTitle}>글쓰기 화면으로 이동 중이에요</Text>
        <Text style={styles.centerDescription}>
          회원 유형에 맞는 글쓰기 화면으로 자동 연결하고 있습니다.
        </Text>
      </View>
    </AppScreen>
  );
}

export function WriteFormScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { user, addPost, authToken } = useAppContext();
  const postType = user ? (isBeneficiaryUser(user) ? 'need' : 'share') : type === 'need' ? 'need' : 'share';
  const [selectedImage, setSelectedImage] = useState<UploadableImage | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const navigateToHome = () => {
    router.replace('/(tabs)/index');
  };

  const analyzeImage = async (image: UploadableImage) => {
    setChecking(true);
    let result;
    try {
      result = await postAPI.checkHarmfulItem(image, {}, authToken ?? undefined);
    } catch {
      setChecking(false);
      showUnexpectedError('AI 판독 중 오류가 발생했습니다');
      return;
    }
    setChecking(false);

    if (result.error || !result.data) {
      Alert.alert('AI 판독 실패', result.error ?? '사진을 다시 선택해주세요.');
      return;
    }

    if (result.data.isHarmful) {
      Alert.alert(
        '유해물품으로 나눔하실 수 없습니다!',
        result.data.reason ?? '정책상 등록이 제한된 품목입니다.',
        [{ text: '확인', onPress: navigateToHome }],
      );
      return;
    }

    const analysis = result.data;
    setSelectedImage(image);
    setAiAnalysis(analysis);
    if (analysis.recommendedCategory) {
      setFormData((prev) => ({ ...prev, category: prev.category || analysis.recommendedCategory || '' }));
    }
  };

  const handleChooseImage = async (source: 'camera' | 'gallery') => {
    try {
      setSourceModalOpen(false);
      const image = await pickImage(source);
      if (!image) {
        return;
      }

      await analyzeImage(image);
    } catch {
      showUnexpectedError('사진 선택 중 오류가 발생했습니다');
    }
  };

  const handleAutoFill = () => {
    if (!aiAnalysis) return;
    const nextTitle = aiAnalysis.suggestedTitle;
    const nextDescription = aiAnalysis.aiGeneratedPost;

    if (!nextDescription) {
      Alert.alert('AI 추천 글 없음', 'AI가 생성한 게시글 본문을 받지 못했습니다. 백엔드 AI 응답에 ai_generated_post가 포함되어야 합니다.');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      title: nextTitle ?? prev.title,
      description: nextDescription ?? prev.description,
      category: aiAnalysis.recommendedCategory ?? prev.category,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.title;
      delete next.description;
      delete next.category;
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!selectedImage) nextErrors.image = '사진 등록이 필요합니다';
    if (!validateRequired(formData.title)) nextErrors.title = '제목을 입력해주세요';
    if (!validateRequired(formData.category)) nextErrors.category = '카테고리를 선택해주세요';
    if (!validateRequired(formData.description)) nextErrors.description = '설명을 입력해주세요';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      if (!user) {
        Alert.alert('로그인이 필요합니다');
        return;
      }
      if (!validate() || !selectedImage) {
        return;
      }

      setSubmitting(true);
      const result = await addPost({
        type: postType,
        title: formData.title,
        category: formData.category,
        description: formData.description,
        location: user.location,
        images: [selectedImage],
        aiAnalysis,
      });
      setSubmitting(false);

      if (result.error) {
        Alert.alert('등록 실패', result.error);
        return;
      }

      Alert.alert('등록 완료', '게시글이 등록되었습니다.', [
        { text: '확인', onPress: navigateToHome },
      ]);
    } catch {
      setSubmitting(false);
      showUnexpectedError('게시글 등록 중 오류가 발생했습니다');
    }
  };

  return (
    <AppScreen scroll contentContainerStyle={{ paddingBottom: 30 }}>
      <AppHeader
        title={postType === 'share' ? '나눔해요' : '필요해요'}
        right={
          <Pressable style={styles.headerDone} onPress={handleSubmit}>
            <Text style={styles.headerDoneText}>완료</Text>
          </Pressable>
        }
      />

      <View style={styles.section}>
        <View style={styles.writeRoleNotice}>
          <Ionicons
            name={postType === 'share' ? 'gift-outline' : 'hand-left-outline'}
            size={18}
            color={postType === 'share' ? colors.brand : colors.accent}
          />
          <Text style={styles.writeRoleNoticeText}>
            {postType === 'share'
              ? '일반회원은 나눔해요 글만 작성할 수 있도록 연결됩니다.'
              : '취약계층 회원은 필요해요 글만 작성할 수 있도록 연결됩니다.'}
          </Text>
        </View>

        <View style={styles.photoGate}>
          <SectionTitle
            title="1. 사진 등록"
            description="게시글 작성 전 사진부터 등록합니다. 카메라 촬영 또는 갤러리 선택이 가능합니다."
          />
          {selectedImage ? (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: selectedImage.uri }} style={styles.photoPreview} contentFit="cover" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.writeOptionTitle}>{selectedImage.name}</Text>
                <Text style={styles.sectionDescription}>{pickLabelForAnalysis(aiAnalysis)}</Text>
                <Pressable style={styles.changePhotoButton} onPress={() => setSourceModalOpen(true)}>
                  <Text style={styles.changePhotoText}>사진 변경</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.uploadPrompt}>
              <Ionicons name="camera-outline" size={38} color={colors.textLight} />
              <Text style={styles.sectionDescription}>
                {postType === 'share'
                  ? '사진을 올리면 AI가 유해물품 여부를 먼저 판독합니다.'
                  : '사진을 올리면 AI가 물품을 인식해 검색/작성에 도움을 줍니다.'}
              </Text>
              <AppButton label="사진 등록하기" onPress={() => setSourceModalOpen(true)} />
              {errors.image ? <Text style={styles.errorText}>{errors.image}</Text> : null}
            </View>
          )}
          {checking ? <Text style={styles.analysisLoading}>AI가 사진을 판독하고 있어요...</Text> : null}
        </View>

        {selectedImage ? (
          <View style={styles.formCard}>
            <SectionTitle
              title="2. 게시글 작성"
              description="안전 판독이 완료되면 바로 글을 작성할 수 있습니다."
            />

            {aiAnalysis ? (
              <View style={styles.aiSuggestionCard}>
                <Text style={styles.aiSuggestionTitle}>AI 인식 결과</Text>
                {aiAnalysis.suggestedTitle ? (
                  <Text style={styles.aiSuggestionText}>추천 제목: {aiAnalysis.suggestedTitle}</Text>
                ) : (
                  <Text style={styles.aiSuggestionText}>{aiAnalysis.detectedItem}으로 인식했습니다.</Text>
                )}
                {aiAnalysis.recommendedCategory ? (
                  <Text style={styles.aiSuggestionText}>
                    카테고리: {aiAnalysis.recommendedCategoryLabel ?? aiAnalysis.recommendedCategory}
                  </Text>
                ) : null}
                {aiAnalysis.confidence ? (
                  <Text style={styles.aiSuggestionText}>신뢰도: {aiAnalysis.confidence}%</Text>
                ) : null}
                {aiAnalysis.extractedFeatures?.length ? (
                  <View style={styles.aiFeatureList}>
                    {aiAnalysis.extractedFeatures.map((feature) => (
                      <Text key={feature} style={styles.aiFeatureItem}>
                        • {feature}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {aiAnalysis.aiGeneratedPost ? (
                  <Text style={styles.aiGeneratedPost}>{aiAnalysis.aiGeneratedPost}</Text>
                ) : null}
                <AppButton label="AI 추천 글쓰기" variant="secondary" onPress={handleAutoFill} />
              </View>
            ) : null}

            <AppTextField
              label="제목"
              value={formData.title}
              onChangeText={(value) => setFormData((prev) => ({ ...prev, title: value }))}
              error={errors.title}
              placeholder={postType === 'share' ? '나눔할 물품 제목을 입력하세요' : '필요한 물품 제목을 입력하세요'}
            />

            <View style={{ gap: 8 }}>
              <Text style={styles.fieldLabel}>카테고리</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {categoryOptions.filter((category) => category.id !== 'all').map((category) => {
                  const active = formData.category === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setFormData((prev) => ({ ...prev, category: category.id }))}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}>
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{category.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </View>

            <AppTextField
              label="설명"
              multiline
              value={formData.description}
              onChangeText={(value) => setFormData((prev) => ({ ...prev, description: value }))}
              error={errors.description}
              placeholder={
                postType === 'share'
                  ? '물품 상태, 사용 기간, 전달 가능 시간을 적어주세요'
                  : '필요한 이유와 원하는 상태를 적어주세요'
              }
            />

            <View style={styles.locationSummaryCard}>
              <Ionicons name="location" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationSummaryTitle}>{user ? formatLocationLabel(user.location) : '동네 미설정'}</Text>
                <Text style={styles.locationSummarySub}>현재 동네 기준 반경 {user?.location.radiusKm ?? 5}km</Text>
              </View>
              <Pressable onPress={() => router.push('/my-location')}>
                <Text style={styles.changePhotoText}>변경</Text>
              </Pressable>
            </View>

            <AppButton label="게시글 등록" onPress={handleSubmit} loading={submitting} />
          </View>
        ) : null}
      </View>

      <SearchSourceModal visible={sourceModalOpen} onClose={() => setSourceModalOpen(false)} onSelect={handleChooseImage} />
    </AppScreen>
  );
}

export function SearchScreen() {
  const { user, posts } = useAppContext();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    status: 'all',
    distanceKm: 5,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [analysisLabel, setAnalysisLabel] = useState('');
  const allowedSearchPostType = user ? (isBeneficiaryUser(user) ? 'share' : 'need') : 'all';

  const results = useMemo(() => {
    if (!user) return [];

    return filterPostsByRadius(posts, user.location, filters.distanceKm).filter((post) => {
      if (allowedSearchPostType !== 'all' && post.type !== allowedSearchPostType) return false;
      if (filters.type !== 'all' && post.type !== filters.type) return false;
      if (filters.status !== 'all' && post.status !== filters.status) return false;
      if (query && !post.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [allowedSearchPostType, filters, posts, query, user]);

  const runImageSearch = async (source: 'camera' | 'gallery') => {
    try {
      setImageSearchOpen(false);
      const image = await pickImage(source);
      if (!image) return;

      const result = await postAPI.checkHarmfulItem(image);
      if (!result.data) {
        return;
      }

      if (result.data.isHarmful) {
        Alert.alert('검색 안내', '유해물품으로 분류된 이미지는 검색 기준으로 사용하지 않았습니다.');
        return;
      }

      setAnalysisLabel(result.data.detectedItem);
    } catch {
      showUnexpectedError('이미지 검색 중 오류가 발생했습니다');
    }
  };

  return (
    <AppScreen>
      <AppHeader title="검색" />
      <View style={styles.searchHeaderArea}>
        <View style={styles.searchControlsArea}>
          <View style={styles.section}>
            <View style={styles.searchBarRow}>
              <View style={{ flex: 1 }}>
                <AppTextField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="어떤 물품을 찾으시나요?"
                />
              </View>
              <Pressable style={styles.searchIconButton} onPress={() => setFilterOpen(true)}>
                <Ionicons name="options-outline" size={20} color={colors.text} />
              </Pressable>
              <Pressable style={styles.searchIconButton} onPress={() => setImageSearchOpen(true)}>
                <Ionicons name="camera-outline" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.searchMeta}>
          <Text style={styles.sectionDescription}>
            검색 결과 {results.length}개 · 반경 {filters.distanceKm}km
          </Text>
          {analysisLabel ? <Text style={styles.analysisTag}>AI 이미지 검색: {analysisLabel}</Text> : null}
        </View>
      </View>

      <View style={styles.searchBody}>
        <ScrollView
          style={styles.searchScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {results.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentLocation={user?.location}
              onPress={() => router.push(`/post/${post.id}`)}
            />
          ))}
          {results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={42} color={colors.textLight} />
              <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
              <Text style={styles.sectionDescription}>다른 검색어나 필터를 시도해보세요.</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <FilterModal visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={setFilters} />
      <SearchSourceModal visible={imageSearchOpen} onClose={() => setImageSearchOpen(false)} onSelect={runImageSearch} />
    </AppScreen>
  );
}
