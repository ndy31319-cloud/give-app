import { Sparkles } from "lucide-react";
import { PolicyCard } from "./PolicyCard";

interface Policy {
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
  targetTypes?: string[];
}

interface PolicyAITabProps {
  policies: Policy[];
}

export function PolicyAITab({ policies }: PolicyAITabProps) {
  return (
    <div className="p-4">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">회원님께 추천하는 정책</h2>
        </div>
        <p className="text-sm text-gray-600">가입 정보를 바탕으로 맞춤 정책을 추천해드립니다.</p>
      </div>

      <div className="space-y-3">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.id}
            id={policy.id}
            title={policy.title}
            category={policy.category}
            description={policy.description}
            target={policy.target}
            support={policy.support}
          />
        ))}
      </div>
    </div>
  );
}
