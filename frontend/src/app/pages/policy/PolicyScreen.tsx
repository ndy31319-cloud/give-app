import { useState } from "react";
import { Sparkles, Grid3x3, MessageSquare } from "lucide-react";
import { BottomNav } from "@/app/components/BottomNav";
import { PageHeader } from "@/app/components/PageHeader";
import { TabBar } from "@/app/components/TabBar";
import { useApp } from "@/app/context/AppContext";
import { PolicyAITab } from "./components/PolicyAITab";
import { PolicyCategoryTab } from "./components/PolicyCategoryTab";
import { PolicyChatbotTab } from "./components/PolicyChatbotTab";

// 정책 데이터 타입
interface Policy {
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
  targetTypes?: string[]; // 취약계층 유형
}

// Mock 정책 데이터
const mockPolicies: Policy[] = [
  {
    id: "1",
    title: "긴급복지 생계지원",
    category: "생활비",
    description: "갑작스러운 위기상황으로 생계유지가 어려운 저소득 가구를 지원합니다.",
    target: "기초생활수급자, 긴급 위기가구",
    support: "월 최대 62만원 (1인 기준)",
    targetTypes: ["basic_livelihood", "near_poverty"]
  },
  {
    id: "2",
    title: "주거급여 지원",
    category: "주거",
    description: "저소득층의 주거비 부담을 줄이기 위한 임차료 지원 제도입니다.",
    target: "중위소득 47% 이하",
    support: "월 최대 31만원 (지역별 차등)",
    targetTypes: ["basic_livelihood", "near_poverty", "single_parent"]
  },
  {
    id: "3",
    title: "한부모가정 아동양육비",
    category: "양육",
    description: "한부모가정의 아동 양육을 지원하는 정책입니다.",
    target: "한부모가정, 청소년 한부모",
    support: "자녀 1인당 월 20만원",
    targetTypes: ["single_parent"]
  },
  {
    id: "4",
    title: "장애인 활동지원 서비스",
    category: "복지",
    description: "장애인의 자립생활과 사회참여를 지원합니다.",
    target: "만 6세 ~ 64세 장애인",
    support: "월 최대 120시간 활동지원",
    targetTypes: ["disabled"]
  },
  {
    id: "5",
    title: "노인 일자리 지원사업",
    category: "일자리",
    description: "노인의 사회참여와 소득 보충을 위한 일자리를 제공합니다.",
    target: "만 65세 이상 기초연금 수급자",
    support: "월 27만원 (공익활동)",
    targetTypes: ["elderly"]
  },
  {
    id: "6",
    title: "청소년 교육비 지원",
    category: "교육",
    description: "저소득층 청소년의 교육비를 지원합니다.",
    target: "기초생활수급자, 차상위계층 자녀",
    support: "학기당 최대 80만원",
    targetTypes: ["youth", "basic_livelihood", "near_poverty"]
  },
  {
    id: "7",
    title: "의료급여 지원",
    category: "의료",
    description: "저소득층의 의료비 부담을 경감하기 위한 지원",
    target: "기초생활수급자",
    support: "본인부담금 감면",
    targetTypes: ["basic_livelihood", "disabled", "elderly"]
  }
];

export function PolicyScreen() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<"ai" | "category" | "chatbot">("ai");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<{ text: string; sender: "user" | "bot" }[]>([
    { text: "안녕하세요! 필요하신 정책을 찾아드리겠습니다. 현재 상황이나 필요하신 지원을 말씀해주세요.", sender: "bot" }
  ]);
  const [chatInput, setChatInput] = useState("");

  const categories = ["생활비", "주거", "의료", "교육", "양육", "일자리", "복지", "기타"];

  const tabs = [
    { id: "ai", label: "AI 추천", icon: <Sparkles className="w-4 h-4" /> },
    { id: "category", label: "카테고리", icon: <Grid3x3 className="w-4 h-4" /> },
    { id: "chatbot", label: "챗봇", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;

    setChatMessages(prev => [...prev, { text: chatInput, sender: "user" }]);

    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        text: `"${chatInput}"에 대한 정책을 찾아보니, 긴급복지 생계지원과 주거급여 지원이 적합할 것 같습니다. 상세 정보를 확인해보시겠어요?`,
        sender: "bot"
      }]);
    }, 1000);

    setChatInput("");
  };

  // AI 추천 정책 (사용자 정보 기반)
  const getAIRecommendedPolicies = () => {
    if (!user?.isVulnerable || !user?.vulnerableTypes) {
      // 일반 사용자 또는 정보 없을 경우 기본 정책 반환
      return mockPolicies.slice(0, 3);
    }

    // 사용자의 취약계층 유형에 맞는 정책 필터링
    const matchedPolicies = mockPolicies.filter(policy => {
      if (!policy.targetTypes) return false;
      return user.vulnerableTypes!.some(type => 
        policy.targetTypes!.includes(type)
      );
    });

    // 매칭된 정책이 없으면 기본 정책 반환
    return matchedPolicies.length > 0 ? matchedPolicies : mockPolicies.slice(0, 3);
  };

  // 카테고리 기반 필터링
  const getCategoryFilteredPolicies = () => {
    if (selectedCategories.length === 0) return mockPolicies;
    return mockPolicies.filter(policy => selectedCategories.includes(policy.category));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="정책 찾기" />
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as "ai" | "category" | "chatbot")} />

      {activeTab === "ai" && <PolicyAITab policies={getAIRecommendedPolicies()} />}
      {activeTab === "category" && (
        <PolicyCategoryTab
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
          policies={getCategoryFilteredPolicies()}
        />
      )}
      {activeTab === "chatbot" && (
        <PolicyChatbotTab
          messages={chatMessages}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSend={handleChatSend}
        />
      )}

      <BottomNav />
    </div>
  );
}