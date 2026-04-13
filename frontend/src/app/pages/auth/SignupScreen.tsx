import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function SignupScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">회원가입</h1>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-3">취약계층이신가요?</h2>
          <p className="text-gray-600 text-sm">
            취약계층 인증 시 맞춤형 정책 추천 서비스를 제공해드립니다
          </p>
        </div>

        <div className="w-full space-y-4">
          <Button
            onClick={() => navigate("/vulnerable-select")}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg"
          >
            예, 맞습니다
          </Button>
          <Button
            onClick={() => navigate("/personal-info")}
            variant="outline"
            className="w-full h-14 text-lg"
          >
            아니요
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-8 text-center">
          취약계층 인증은 선택사항이며, 나중에 마이페이지에서도 등록 가능합니다
        </p>
      </div>
    </div>
  );
}