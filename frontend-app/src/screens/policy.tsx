import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppModal } from '@/src/components/common/AppModal';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { PillTabs } from '@/src/components/common/PillTabs';
import { useAppContext } from '@/src/context/AppContext';
import { policyAPI } from '@/src/services/api';
import { colors, radius, spacing } from '@/src/theme/colors';
import { Policy } from '@/src/types/app';
import { normalizeChatbotText, removeApplicationMethodSections, splitChatbotLinks } from '@/src/utils/chatText';
import { LoadingDots } from '@/src/components/common/LoadingDots';

const POLICY_DIRECTORY_URL = 'https://www.gov.kr/portal/rcvfvrSvc/main';
const POLICY_CATEGORIES = ['생활비', '주거', '의료', '교육', '문화', '일자리', '복지'];

function ChatbotReply({ text }: { text: string }) {
  const content = splitChatbotLinks(text).map((part, index) => {
    if (!part.target) return part.text;
    const target = part.target;
    return (
      <Text
        key={`link-${index}`}
        accessibilityRole="link"
        accessibilityLabel={`링크 열기: ${target}`}
        style={styles.chatLink}
        onPress={() => {
          void Linking.openURL(target).catch(() =>
            Alert.alert('링크를 열 수 없어요', '주소를 확인한 뒤 다시 시도해주세요.'));
        }}>
        {part.text}
      </Text>
    );
  });
  return <Text style={styles.chatText}>{content}</Text>;
}

function compactPolicyText(value: string, fallback: string, maxLength = 120) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}…` : normalized;
}

function PolicyCard({
  title,
  category,
  description,
  target,
  support,
  onPress,
}: {
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{category}</Text>
        </View>
      </View>
      <Text style={styles.cardDescription} numberOfLines={2} ellipsizeMode="tail">
        {compactPolicyText(description, '정책 내용을 확인해보세요.', 110)}
      </Text>
      <View style={styles.metaBlock}>
        <Text style={styles.metaLine} numberOfLines={1} ellipsizeMode="tail">
          대상: {compactPolicyText(target, '상세 조건 확인 필요', 72)}
        </Text>
        <Text style={styles.metaLine} numberOfLines={1} ellipsizeMode="tail">
          지원: {compactPolicyText(support, '지원 내용 확인 필요', 72)}
        </Text>
      </View>
      <AppButton label="자세히 보기" variant="secondary" onPress={onPress} />
    </Pressable>
  );
}

export function PolicyScreen() {
  const { authToken, user } = useAppContext();
  const [activeTab, setActiveTab] = useState<'ai' | 'category' | 'chatbot'>('ai');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPolicies, setAllPolicies] = useState<Policy[]>([]);
  const [recommendedPolicies, setRecommendedPolicies] = useState<Policy[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [allPoliciesLoading, setAllPoliciesLoading] = useState(false);
  const [allPoliciesLoaded, setAllPoliciesLoaded] = useState(false);
  const [loadedCategory, setLoadedCategory] = useState<string | null>(null);
  const [allPoliciesError, setAllPoliciesError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatResetting, setChatResetting] = useState(false);
  const chatResetLock = useRef(false);
  const chatRequestLock = useRef(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const resetChat = async (start: boolean) => {
    if (chatRequestLock.current || chatResetLock.current) return;
    Keyboard.dismiss();
    chatResetLock.current = true;
    setChatResetting(true);

    // Starting/ending a chat must not depend on the history cleanup request.
    // The visible conversation is local state; server cleanup is best effort.
    setChatInput('');
    setMessages(start ? [{ sender: 'bot', text: '안녕하세요! 현재 상황이나 필요하신 지원을 말씀해주시면 알맞은 정책을 추천해드릴게요.' }] : []);
    setChatStarted(start);

    try {
      if (authToken) {
        // Clear abandoned sessions too, so Start begins with fresh context.
        const result = await policyAPI.clearChatbotHistory(authToken);
        if (result.error) {
          console.warn('Chat history cleanup skipped:', result.error);
        }
      }
    } catch {
      console.warn('Chat history cleanup request failed. Continuing with local chat.');
    } finally {
      chatResetLock.current = false;
      setChatResetting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    setAllPolicies([]);
    setAllPoliciesLoaded(false);
    setLoadedCategory(null);
    setAllPoliciesError(null);

    async function loadRecommendedPolicies() {
      setRecommendedLoading(true);
      try {
        const recommendedResult = await policyAPI.listRecommended(authToken ?? undefined);
        if (mounted) {
          setRecommendedPolicies(recommendedResult.data ?? []);
        }
      } catch (error) {
        console.warn('Policy recommendation load failed:', error);
        if (mounted) {
          setRecommendedPolicies([]);
        }
      } finally {
        if (mounted) {
          setRecommendedLoading(false);
        }
      }
    }

    void loadRecommendedPolicies();
    return () => {
      mounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    const selectedCategory = selectedCategories[0] ?? '';
    if (
      activeTab !== 'category' ||
      !selectedCategory ||
      allPoliciesLoading ||
      Boolean(allPoliciesError) ||
      (allPoliciesLoaded && loadedCategory === selectedCategory)
    ) {
      return;
    }

    let mounted = true;
    setAllPoliciesLoading(true);
    setAllPoliciesError(null);

    async function loadAllPolicies() {
      try {
        const allResult = await policyAPI.listPolicies(authToken ?? undefined, selectedCategory);
        if (mounted) {
          setAllPolicies(allResult.data ?? []);
          setAllPoliciesLoaded(!allResult.error);
          setLoadedCategory(allResult.error ? null : selectedCategory);
          setAllPoliciesError(allResult.error);
        }
      } catch (error) {
        console.warn('Policy list load failed:', error);
        if (mounted) {
          setAllPolicies([]);
          setAllPoliciesLoaded(false);
          setLoadedCategory(null);
          setAllPoliciesError('정책 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (mounted) {
          setAllPoliciesLoading(false);
        }
      }
    }

    void loadAllPolicies();
    return () => {
      mounted = false;
    };
  }, [activeTab, allPoliciesLoaded, allPoliciesLoading, authToken, loadedCategory, selectedCategories]);

  useEffect(() => {
    if (activeTab !== 'category') return;
    // Warm the small category responses in parallel. The API layer deduplicates
    // overlapping requests and keeps the results for subsequent visits.
    void Promise.all(POLICY_CATEGORIES.map((category) => policyAPI.listPolicies(authToken ?? undefined, category))).catch(() => {
      // The selected category request still reports its own error in the UI.
    });
  }, [activeTab, authToken]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPolicies = useMemo(() => {
    if (!normalizedQuery) {
      return allPolicies;
    }

    return allPolicies.filter((policy) => {
      const searchableText = [policy.title, policy.category, policy.agency, policy.content, policy.target, policy.support]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [allPolicies, normalizedQuery]);

  const visibleRecommendedPolicies = useMemo(() => {
    if (!normalizedQuery) {
      return recommendedPolicies;
    }

    return recommendedPolicies.filter((policy) => {
      const searchableText = [policy.title, policy.category, policy.agency, policy.content, policy.target, policy.support]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, recommendedPolicies]);

  const categoryPolicies = useMemo(() => {
    if (!selectedCategories.length) return [];
    return filteredPolicies.filter((policy) => selectedCategories.includes(policy.category));
  }, [filteredPolicies, selectedCategories]);

  const retryCategoryPolicies = () => {
    setAllPoliciesLoaded(false);
    setLoadedCategory(null);
    setAllPoliciesError(null);
  };

  const saveSearchHistory = async (queryText: string) => {
    if (!user?.id) {
      return;
    }

    const result = await policyAPI.createSearchHistory({
      memberId: user.id,
      queryText,
      authToken: authToken ?? undefined,
    });

    if (result.error) {
      Alert.alert('기록 저장 실패', result.error);
    }
  };

  const handleSearch = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    await saveSearchHistory(trimmed);
  };

  const handlePolicyPress = async (policy: Policy, source: 'recommended' | 'browse') => {
    setSelectedPolicy(policy);
    if (!user?.id) return;

    const result = await policyAPI.createSearchHistory({
      memberId: user.id,
      recommendPolicyId: source === 'recommended' ? policy.id : undefined,
      policyId: policy.id,
      authToken: authToken ?? undefined,
    });

    if (result.error) {
      Alert.alert('기록 저장 실패', result.error);
    }
  };

  const openPolicyLink = async (url: string, label: string) => {
    const normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      Alert.alert('링크를 열 수 없어요', `${label} 주소가 올바르지 않습니다.`);
      return;
    }
    const supported = await Linking.canOpenURL(normalized).catch(() => false);
    if (!supported) {
      Alert.alert('링크를 열 수 없어요', '브라우저에서 주소를 확인해주세요.');
      return;
    }
    await Linking.openURL(normalized).catch(() =>
      Alert.alert('링크를 열 수 없어요', '잠시 후 다시 시도해주세요.'),
    );
  };

  const sendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || !chatStarted || chatRequestLock.current || chatResetLock.current) return;

    if (!authToken) {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: '로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.' },
      ]);
      return;
    }

    Keyboard.dismiss();
    chatRequestLock.current = true;
    setChatPending(true);
    const nextMessages = [...messages, { sender: 'user' as const, text: trimmed }];
    // Reserve the assistant bubble immediately so the first streamed token
    // appears in place instead of moving the conversation unexpectedly.
    setMessages([...nextMessages, { sender: 'bot', text: '' }]);
    setChatInput('');
    try {
      requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: false }));
      const result = await policyAPI.askChatbotStream(
        trimmed,
        nextMessages.map((chatMessage) => ({ role: chatMessage.sender, message: chatMessage.text })),
        authToken ?? undefined,
        () => requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: false })),
      );
      const responseText = result.data?.response ?? result.error ?? '정책 챗봇 응답을 받을 수 없습니다.';
      setMessages((prev) => prev.map((item, index) =>
        index === prev.length - 1 && item.sender === 'bot'
          ? { ...item, text: responseText }
          : item,
      ));
    } catch {
      setMessages(prev => prev.map((item, index) =>
        index === prev.length - 1 && item.sender === 'bot'
          ? { ...item, text: '답변을 받지 못했어요. 잠시 후 다시 시도해주세요.' }
          : item,
      ));
    } finally {
      chatRequestLock.current = false;
      setChatPending(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.policyHeaderArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>정책 찾기</Text>
          <Text style={styles.headerSubtitle}>사용자 정보와 상황을 바탕으로 정책을 찾아보세요.</Text>
        </View>

        <View style={styles.searchArea}>
          <View style={{ flex: 1 }}>
            <AppTextField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="정책명을 검색해보세요"
              onSubmitEditing={handleSearch}
            />
          </View>
          <AppButton label="검색" onPress={handleSearch} />
        </View>

        <View style={styles.policyTabsWrap}>
          <PillTabs
            tabs={[
              { id: 'ai', label: 'AI 추천' },
              { id: 'category', label: '카테고리' },
              { id: 'chatbot', label: '챗봇' },
            ]}
            value={activeTab}
            onChange={(value) => setActiveTab(value as 'ai' | 'category' | 'chatbot')}
          />
        </View>
      </View>

      <View style={styles.policyBody}>
        {activeTab === 'ai' ? (
          <FlatList
            data={visibleRecommendedPolicies}
            keyExtractor={(policy) => policy.id}
            style={styles.policyScroll}
            contentContainerStyle={styles.content}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.highlightCard}>
                <Text style={styles.highlightTitle}>회원님께 추천하는 정책</Text>
                <Text style={styles.highlightText}>가입 정보와 취약계층 여부를 바탕으로 맞춤 정책을 우선 노출합니다.</Text>
              </View>
            }
            renderItem={({ item: policy }) => (
              <PolicyCard {...policy} onPress={() => handlePolicyPress(policy, 'recommended')} />
            )}
            ListEmptyComponent={
              recommendedLoading ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>추천 정책을 불러오는 중이에요.</Text>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>추천 정책이 아직 없어요.</Text>
                  <Text style={styles.emptyStateText}>조건에 맞는 정책이 없거나 아직 불러오지 못했습니다.</Text>
                </View>
              )
            }
          />
        ) : null}

        {activeTab === 'category' ? (
          <FlatList
            data={categoryPolicies}
            keyExtractor={(policy) => policy.id}
            style={styles.policyScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews
            ListHeaderComponent={
              <View style={styles.categoryGrid}>
                {POLICY_CATEGORIES.map((category) => {
                  const active = selectedCategories.includes(category);
                  return (
                    <Pressable
                      key={category}
                      onPress={() => {
                        setSelectedCategories(active ? [] : [category]);
                        setAllPolicies([]);
                        setAllPoliciesLoaded(false);
                        setLoadedCategory(null);
                        setAllPoliciesError(null);
                      }}
                      style={[styles.categoryButton, active && styles.categoryButtonActive]}>
                      <Text style={[styles.categoryButtonText, active && styles.categoryButtonTextActive]}>{category}</Text>
                    </Pressable>
                  );
                })}
              </View>
            }
            renderItem={({ item: policy }) => (
              <PolicyCard {...policy} onPress={() => handlePolicyPress(policy, 'browse')} />
            )}
            ListEmptyComponent={
              allPoliciesLoading ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>정책 목록을 불러오는 중이에요.</Text>
                </View>
              ) : allPoliciesError ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>정책 목록을 불러오지 못했어요.</Text>
                  <Text style={styles.emptyStateText}>{allPoliciesError}</Text>
                  <AppButton label="다시 불러오기" variant="secondary" onPress={retryCategoryPolicies} />
                </View>
              ) : !selectedCategories.length ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>카테고리를 선택해주세요.</Text>
                  <Text style={styles.emptyStateText}>원하는 분야를 선택하면 해당 정책 목록이 표시됩니다.</Text>
                </View>
              ) : (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>조건에 맞는 정책이 없습니다.</Text>
                  <Text style={styles.emptyStateText}>검색어나 카테고리를 바꿔보세요.</Text>
                </View>
              )
            }
          />
        ) : null}

        {activeTab === 'chatbot' ? (
          <View style={styles.chatWrap}>
            {!chatStarted ? (
              <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatStart} showsVerticalScrollIndicator={false}>
                <View style={styles.chatStartCard}>
                  <Text style={[styles.chatStartTitle, styles.chatStartCentered]}>나눔이와 이야기해요</Text>
                  <Text style={[styles.chatStartDescription, styles.chatStartCentered]}>필요한 복지 정보를 물어보세요.</Text>
                  <Text style={[styles.chatStartDescription, styles.chatStartCentered]}>종료하기를 누르면{ '\n' }대화 내역이 삭제돼요.</Text>
                  <AppButton label="시작하기" style={styles.chatStartButton} loading={chatResetting} onPress={() => void resetChat(true)} />
                </View>
              </ScrollView>
            ) : <>
            <View style={styles.chatToolbar}>
              <Text style={styles.chatStartTitle}>나눔이</Text>
              <AppButton label="종료하기" variant="secondary" style={styles.chatExitButton} loading={chatResetting} disabled={chatPending} onPress={() => void resetChat(false)} />
            </View>
            {chatPending && <Text style={styles.chatStartDescription}>답변이 끝나면 대화를 종료할 수 있어요.</Text>}
            <ScrollView
              ref={chatScrollRef}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              style={styles.chatScroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {messages.map((message, index) => (
                <View
                  key={`${message.sender}-${index}`}
                  style={[styles.chatBubble, message.sender === 'user' ? styles.chatUser : styles.chatBot]}>
                  {message.sender === 'bot' ? (message.text ? <ChatbotReply text={removeApplicationMethodSections(normalizeChatbotText(message.text))} /> : <LoadingDots accessibilityLabel="나눔이가 답변을 작성하고 있어요" />) : (
                    <Text style={[styles.chatText, { color: '#fff' }]}>{message.text}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInputArea}>
              <View style={{ flex: 1 }}>
                <AppTextField
                  value={chatInput}
                  onChangeText={setChatInput}
                  editable={!chatResetting}
                  placeholder="상황이나 필요하신 지원을 입력하세요"
                />
              </View>
              <AppButton label="전송" disabled={chatPending || chatResetting || !chatInput.trim()} onPress={sendChat} />
            </View>
            </>}
          </View>
        ) : null}
      </View>
      <AppModal visible={Boolean(selectedPolicy)} onClose={() => setSelectedPolicy(null)}>
        {selectedPolicy ? (
          <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.policyDetailContent}>
            <Text style={styles.policyDetailTitle}>{selectedPolicy.title}</Text>
            <Text style={styles.policyDetailAgency}>{selectedPolicy.agency} · {selectedPolicy.category}</Text>
            <Text style={styles.policyDetailSection}>정책 내용</Text>
            <Text style={styles.policyDetailText}>{selectedPolicy.content || selectedPolicy.description || '상세 내용이 준비 중입니다.'}</Text>
            <Text style={styles.policyDetailSection}>지원 대상</Text>
            <Text style={styles.policyDetailText}>{selectedPolicy.target || selectedPolicy.targetCriteria || '지원 대상 정보를 확인해주세요.'}</Text>
            <Text style={styles.policyDetailSection}>지원 내용 및 신청 방법</Text>
            <Text style={styles.policyDetailText}>{selectedPolicy.support || '관할 행정복지센터 또는 해당 기관에 문의해주세요.'}</Text>
            <Text style={styles.policyDetailText}>
              {selectedPolicy.applicationMethod || '신청 절차는 아래 공식 안내에서 확인해주세요.'}
            </Text>
            {selectedPolicy.applicationPeriod ? (
              <Text style={styles.policyDetailHint}>신청 기간: {selectedPolicy.applicationPeriod}</Text>
            ) : null}
            <Pressable
              accessibilityRole="link"
              onPress={() => void openPolicyLink(
                selectedPolicy.officialUrl || selectedPolicy.applicationUrl || POLICY_DIRECTORY_URL,
                '공식',
              )}
              style={styles.policyLinkButton}>
              <Text style={styles.policyLinkText}>공식 안내 및 신청 경로 열기</Text>
              <Text style={styles.policyLinkUrl} numberOfLines={2}>
                {selectedPolicy.officialUrl || selectedPolicy.applicationUrl || POLICY_DIRECTORY_URL}
              </Text>
            </Pressable>
            <AppButton label="닫기" onPress={() => setSelectedPolicy(null)} />
          </ScrollView>
        ) : null}
      </AppModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  policyHeaderArea: {
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 6,
    gap: 6,
    backgroundColor: colors.surface,
  },
  policyTabsWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  policyBody: {
    flex: 1,
  },
  policyScroll: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  searchArea: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    gap: 14,
  },
  highlightCard: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
    gap: 6,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  emptyStateCard: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  card: {
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
  },
  metaBlock: {
    gap: 6,
  },
  metaLine: {
    fontSize: 14,
    color: colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },
  categoryButton: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  categoryButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  categoryButtonTextActive: {
    color: colors.brand,
  },
  chatWrap: {
    flex: 1,
  },
  chatStart: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  chatStartCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatStartButton: { alignSelf: 'center', minWidth: 128, paddingHorizontal: 28, marginTop: 4 },
  chatStartTitle: { fontSize: 18, lineHeight: 28, paddingVertical: 2, fontWeight: '700', color: colors.text },
  chatStartDescription: { fontSize: 14, lineHeight: 24, paddingVertical: 2, color: colors.textMuted },
  chatStartCentered: { textAlign: 'center', alignSelf: 'stretch', flexShrink: 0 },
  chatToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  chatExitButton: {
    minWidth: 116,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chatScroll: {
    flex: 1,
  },
  chatBubble: {
    maxWidth: '84%',
    padding: 14,
    borderRadius: radius.lg,
  },
  chatBot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  chatUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  chatLink: {
    color: colors.brand,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  chatInputArea: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  policyDetailContent: {
    gap: 12,
    paddingBottom: 4,
  },
  policyDetailTitle: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.text,
  },
  policyDetailAgency: {
    fontSize: 13,
    color: colors.textMuted,
  },
  policyDetailSection: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '800',
    color: colors.brand,
  },
  policyDetailText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  policyDetailHint: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  policyLinkButton: {
    gap: 4,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  policyLinkText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.brand,
  },
  policyLinkUrl: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
