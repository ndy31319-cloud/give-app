import { useNavigate } from "react-router";
import { User, Settings, MapPin, Heart, FileText, BarChart3, ChevronRight, MessageCircle } from "lucide-react";
import { BottomNav } from "@/app/components/BottomNav";
import { Button } from "@/app/components/ui/button";

export function MyPageScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">마이페이지</h1>
        <button onClick={() => navigate("/settings")}>
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Profile Section */}
      <div className="bg-white px-4 py-6 mb-2">
        <div className="flex items-center mb-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mr-4">
            <User className="w-8 h-8 text-gray-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">홍길동</h2>
            <div className="text-sm text-gray-600 flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              역삼동
            </div>
          </div>
        </div>
        <Button
          onClick={() => navigate("/profile-edit")}
          variant="outline"
          className="w-full"
        >
          프로필 수정
        </Button>
      </div>

      {/* Stats */}
      <div className="bg-white px-4 py-6 mb-2">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">12</div>
            <div className="text-sm text-gray-600">나눔</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">5</div>
            <div className="text-sm text-gray-600">신청</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-white mb-2">
        <button
          onClick={() => navigate("/my-location")}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center">
            <MapPin className="w-5 h-5 mr-3 text-gray-600" />
            <span>내 동네 설정</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <button
          onClick={() => navigate("/my-shares")}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100"
        >
          <div className="flex items-center">
            <Heart className="w-5 h-5 mr-3 text-gray-600" />
            <span>나의 나눔/활동</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <button
          onClick={() => navigate("/my-stats")}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100"
        >
          <div className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-3 text-gray-600" />
            <span>나눔통계</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
        <button
          onClick={() => navigate("/contact-admin")}
          className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100"
        >
          <div className="flex items-center">
            <MessageCircle className="w-5 h-5 mr-3 text-gray-600" />
            <span>관리자에게 문의하기</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}