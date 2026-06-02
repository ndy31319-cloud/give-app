import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppScreen } from '@/src/components/common/AppScreen';
import { AppTextField } from '@/src/components/common/AppTextField';
import { PillTabs } from '@/src/components/common/PillTabs';
import { useAppContext } from '@/src/context/AppContext';
import { policyAPI } from '@/src/services/api';
import { colors, radius, spacing } from '@/src/theme/colors';
import { Policy } from '@/src/types/app';

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
      <Text style={styles.cardDescription}>{description}</Text>
      <View style={styles.metaBlock}>
        <Text style={styles.metaLine}>대상: {target}</Text>
        <Text style={styles.metaLine}>지원: {support}</Text>
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
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    {
      sender: 'bot',
      text: '안녕하세요! 현재 상황이나 필요하신 지원을 말씀해주시면 알맞은 정책을 추천해드릴게요.',
    },
  ]);

  const categories = ['생활비', '주거', '의료', '교육', '문화', '일자리', '복지'];

  useEffect(() => {
    let mounted = true;

    async function loadPolicies() {
      const [allResult, recommendedResult] = await Promise.all([
        policyAPI.listPolicies(authToken ?? undefined),
        policyAPI.listRecommended(authToken ?? undefined),
      ]);

      if (mounted) {
        setAllPolicies(allResult.data ?? []);
        setRecommendedPolicies(recommendedResult.data ?? []);
      }
    }

    loadPolicies();
    return () => {
      mounted = false;
    };
  }, [authToken]);

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
    if (!selectedCategories.length) return filteredPolicies;
    return filteredPolicies.filter((policy) => selectedCategories.includes(policy.category));
  }, [filteredPolicies, selectedCategories]);

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
    if (!user?.id) {
      return;
    }

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

  const sendChat = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
    setChatInput('');
    const result = await policyAPI.askChatbot(
      trimmed,
      messages.map((message) => ({ role: message.sender, message: message.text })),
      authToken ?? undefined,
    );
    setMessages((prev) => [
      ...prev,
      {
        sender: 'bot',
        text: result.data?.response ?? result.error ?? '정책 챗봇 응답을 받을 수 없습니다.',
      },
    ]);
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
          <ScrollView
            style={styles.policyScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.highlightCard}>
              <Text style={styles.highlightTitle}>회원님께 추천하는 정책</Text>
              <Text style={styles.highlightText}>가입 정보와 취약계층 여부를 바탕으로 맞춤 정책을 우선 노출합니다.</Text>
            </View>
            {visibleRecommendedPolicies.length ? (
              visibleRecommendedPolicies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  {...policy}
                  onPress={() => handlePolicyPress(policy, 'recommended')}
                />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>추천 정책이 아직 없어요.</Text>
                <Text style={styles.emptyStateText}>조건에 맞는 정책이 없거나 아직 불러오지 못했습니다.</Text>
              </View>
            )}
          </ScrollView>
        ) : null}

        {activeTab === 'category' ? (
          <ScrollView
            style={styles.policyScroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const active = selectedCategories.includes(category);
                return (
                  <Pressable
                    key={category}
                    onPress={() =>
                      setSelectedCategories(active ? [] : [category])
                    }
                    style={[styles.categoryButton, active && styles.categoryButtonActive]}>
                    <Text style={[styles.categoryButtonText, active && styles.categoryButtonTextActive]}>{category}</Text>
                  </Pressable>
                );
              })}
            </View>
            {categoryPolicies.length ? (
              categoryPolicies.map((policy) => (
                <PolicyCard key={policy.id} {...policy} onPress={() => handlePolicyPress(policy, 'browse')} />
              ))
            ) : (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>조건에 맞는 정책이 없습니다.</Text>
                <Text style={styles.emptyStateText}>검색어나 카테고리를 바꿔보세요.</Text>
              </View>
            )}
          </ScrollView>
        ) : null}

        {activeTab === 'chatbot' ? (
          <View style={styles.chatWrap}>
            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {messages.map((message, index) => (
                <View
                  key={`${message.sender}-${index}`}
                  style={[styles.chatBubble, message.sender === 'user' ? styles.chatUser : styles.chatBot]}>
                  <Text style={[styles.chatText, message.sender === 'user' && { color: '#fff' }]}>{message.text}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInputArea}>
              <View style={{ flex: 1 }}>
                <AppTextField
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="상황이나 필요하신 지원을 입력하세요"
                />
              </View>
              <AppButton label="전송" onPress={sendChat} />
            </View>
          </View>
        ) : null}
      </View>
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
});
