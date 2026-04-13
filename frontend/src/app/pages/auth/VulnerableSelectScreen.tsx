import { useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { ArrowLeft, Heart } from "lucide-react";
import { useApp } from "@/app/context/AppContext";

export function VulnerableSelectScreen() {
  const navigate = useNavigate();
  const { setSignupData } = useApp();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [error, setError] = useState("");

  const vulnerableTypes = [
    { id: "basic_livelihood", label: "기초생활수급자" },
    { id: "near_poverty", label: "차상위계층" },
    { id: "single_parent", label: "한부모가정" },
    { id: "disabled", label: "장애인" },
    { id: "elderly", label: "노인" },
    { id: "youth", label: "아동/청소년" },
    { id: "other", label: "기타" },
  ];

  const handleToggle = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
    setError("");
  };

  const handleNext = () => {
    if (selectedTypes.length === 0) {
      setError("최소 한 가지 이상 선택해주세요");
      return;
    }

    // 전역 상태에 저장
    setSignupData({ isVulnerable: true, vulnerableTypes: selectedTypes });
    navigate("/vulnerable-info");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="ml-2 text-lg font-semibold">취약계층 유형 선택</h1>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-6 text-center">
          <Heart className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600">
            해당하시는 유형을 선택해주세요 (복수 선택 가능)
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {vulnerableTypes.map((type) => (
            <div
              key={type.id}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                selectedTypes.includes(type.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => handleToggle(type.id)}
            >
              <Checkbox
                checked={selectedTypes.includes(type.id)}
                onCheckedChange={() => handleToggle(type.id)}
              />
              <label className="flex-1 cursor-pointer">{type.label}</label>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <Button
          onClick={handleNext}
          className="w-full"
          disabled={selectedTypes.length === 0}
        >
          다음
        </Button>
      </div>
    </div>
  );
}