import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useApp } from "@/app/context/AppContext";
import { authAPI, saveUserId } from "@/app/services/api";

const LOCATION_OPTIONS = [
  "서울특별시 강남구 삼성동",
  "서울특별시 강남구 역삼동",
  "서울특별시 서초구 서초동",
  "서울특별시 강남구 압구정동",
  "서울특별시 송파구 잠실동",
];

export function LocationSettingScreen() {
  const navigate = useNavigate();
  const { signupData, setUser, setSignupData } = useApp();
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredResults = useMemo(() => {
    if (!location.trim()) {
      return LOCATION_OPTIONS;
    }

    return LOCATION_OPTIONS.filter((result) =>
      result.toLowerCase().includes(location.toLowerCase()),
    );
  }, [location]);

  const handleSelectLocation = (value: string) => {
    setSelectedLocation(value);
    setLocation(value);
    setSubmitError("");
  };

  const handleSignup = async () => {
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
      location: selectedLocation || location.trim() || "미설정",
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
      <div className="sticky top-0 flex items-center border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">지역 설정</h1>
      </div>

      <div className="px-6 py-8">
        <div className="mb-6">
          <p className="mb-2 text-gray-600">현재는 지역을 직접 선택한 뒤 회원가입을 진행할 수 있어요.</p>
          <p className="mb-4 text-sm text-gray-500">
            나중에는 현재 위치 기반으로 자동 설정되도록 연결하면 됩니다.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setSelectedLocation("");
              }}
              placeholder="동네 이름을 검색해주세요"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredResults.length > 0 ? (
            filteredResults.map((result) => {
              const isSelected = result === selectedLocation;

              return (
                <button
                  key={result}
                  type="button"
                  onClick={() => handleSelectLocation(result)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-blue-600 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-center">
                    <MapPin className="mr-3 h-5 w-5 text-blue-600" />
                    <span>{result}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="py-8 text-center text-gray-500">검색 결과가 없습니다.</p>
          )}
        </div>

        {selectedLocation && (
          <p className="mt-4 text-sm text-blue-700">선택된 지역: {selectedLocation}</p>
        )}

        {submitError && <p className="mt-6 text-sm text-red-500">{submitError}</p>}

        <div className="mt-8">
          <Button onClick={handleSignup} className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "회원가입 처리 중..." : "회원가입"}
          </Button>
        </div>
      </div>
    </div>
  );
}
