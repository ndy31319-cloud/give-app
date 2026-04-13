import { useNavigate } from "react-router";
import { ArrowLeft, Gift, HandHeart } from "lucide-react";
import { BottomNav } from "@/app/components/BottomNav";

export function WriteSelectScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-16">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">글쓰기</h1>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-2">어떤 글을 작성하시겠어요?</h2>
          <p className="text-gray-600">나눔의 방법을 선택해주세요</p>
        </div>

        <div className="w-full space-y-4">
          <button
            onClick={() => navigate("/write/form?type=share")}
            className="w-full p-8 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <div className="flex flex-col items-center">
              <Gift className="w-16 h-16 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-2">나눔해요</h3>
              <p className="text-sm text-gray-600">
                더 이상 필요 없는 물건을 나눔합니다
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate("/write/form?type=need")}
            className="w-full p-8 border-2 border-orange-500 rounded-lg hover:bg-orange-50 transition-colors"
          >
            <div className="flex flex-col items-center">
              <HandHeart className="w-16 h-16 text-orange-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">필요해요</h3>
              <p className="text-sm text-gray-600">
                필요한 물건을 요청합니다
              </p>
            </div>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}