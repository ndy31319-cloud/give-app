import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { useApp } from "@/app/context/AppContext";
import { authAPI, saveUserId } from "@/app/services/api";

export function LocationSettingScreen() {
  const navigate = useNavigate();
  const { signupData, setUser, setSignupData } = useApp();
  const [location, setLocation] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults] = useState([
    "서울특별시 강남구 역삼동",
    "서울특별시 강남구 삼성동",
    "서울특별시 서초구 서초동",
    "서울특별시 강남구 논현동",
    "서울특별시 송파구 잠실동",
  ]);

  const filteredResults = location
    ? searchResults.filter((result) => result.toLowerCase().includes(location.toLowerCase()))
    : searchResults;

  const handleComplete = async (selectedLocation: string) => {
    if (!signupData?.name || !signupData?.email || !signupData?.phone || !signupData?.password) {
      setSubmitError("회원가입 정보가 부족합니다. 처음부터 다시 진행해주세요.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const result = await authAPI.signup({
      name: signupData.name,
      email: signupData.email,
      phone: signupData.phone,
      password: signupData.password,
      birthdate: signupData.birthdate || "",
      isVulnerable: signupData.isVulnerable || false,
      vulnerableTypes: signupData.vulnerableTypes,
      location: selectedLocation,
    });

    setIsSubmitting(false);

    if (result.error || !result.data) {
      setSubmitError(result.error || "회원가입에 실패했습니다.");
      return;
    }

    setUser(result.data.user);
    saveUserId(result.data.user.id);
    setSignupData(null);
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">동네 설정</h1>
      </div>

      <div className="px-6 py-8">
        <div className="mb-6">
          <p className="text-gray-600 mb-4">우리 동네를 설정하고 이웃과 나눔을 시작해보세요</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="동네 이름을 검색하세요"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredResults.length > 0 ? (
            filteredResults.map((result) => (
              <button
                key={result}
                onClick={() => handleComplete(result)}
                disabled={isSubmitting}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-colors text-left disabled:opacity-60"
              >
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 text-blue-600 mr-3" />
                  <span>{result}</span>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">검색 결과가 없습니다</p>
          )}
        </div>

        {submitError && <p className="text-red-500 text-sm mt-6">{submitError}</p>}

        <div className="mt-8">
          <Button
            onClick={() => handleComplete("미설정")}
            variant="outline"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "가입 처리 중..." : "나중에 설정하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
