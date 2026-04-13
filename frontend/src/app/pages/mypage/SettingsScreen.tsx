import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, Lock, FileText, HelpCircle, LogOut } from "lucide-react";
import { Switch } from "@/app/components/ui/switch";
import { Button } from "@/app/components/ui/button";

export function SettingsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({
    push: true,
    newPost: true,
    chat: true,
    activity: false,
  });

  const handleLogout = () => {
    // 프론트엔드에서만 처리
    console.log("로그아웃");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate("/mypage")} className="mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">설정</h1>
      </div>

      {/* Notification Settings */}
      <div className="bg-white mb-2">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold flex items-center">
            <Bell className="w-5 h-5 mr-2 text-gray-600" />
            알림 설정
          </h2>
        </div>
        <div className="px-4 py-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">푸시 알림</div>
              <div className="text-sm text-gray-600">모든 알림 받기</div>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, push: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">새 게시글 알림</div>
              <div className="text-sm text-gray-600">내 동네에 새 게시글이 올라올 때</div>
            </div>
            <Switch
              checked={notifications.newPost}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, newPost: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">채팅 알림</div>
              <div className="text-sm text-gray-600">새로운 메시지가 도착할 때</div>
            </div>
            <Switch
              checked={notifications.chat}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, chat: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">활동 알림</div>
              <div className="text-sm text-gray-600">나눔 완료, 예약 등</div>
            </div>
            <Switch
              checked={notifications.activity}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, activity: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-white mb-2">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold flex items-center">
            <Lock className="w-5 h-5 mr-2 text-gray-600" />
            개인정보 및 보안
          </h2>
        </div>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50">
          <span>비밀번호 변경</span>
          <span className="text-gray-400">›</span>
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100">
          <span>개인정보 관리</span>
          <span className="text-gray-400">›</span>
        </button>
      </div>

      {/* Terms & Support */}
      <div className="bg-white mb-2">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold flex items-center">
            <FileText className="w-5 h-5 mr-2 text-gray-600" />
            약관 및 정책
          </h2>
        </div>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50">
          <span>서비스 이용약관</span>
          <span className="text-gray-400">›</span>
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100">
          <span>개인정보 처리방침</span>
          <span className="text-gray-400">›</span>
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100">
          <span>위치기반 서비스 이용약관</span>
          <span className="text-gray-400">›</span>
        </button>
      </div>

      {/* Help & Info */}
      <div className="bg-white mb-2">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold flex items-center">
            <HelpCircle className="w-5 h-5 mr-2 text-gray-600" />
            도움말 및 정보
          </h2>
        </div>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50">
          <span>공지사항</span>
          <span className="text-gray-400">›</span>
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100">
          <span>자주 묻는 질문</span>
          <span className="text-gray-400">›</span>
        </button>
        <button className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 border-t border-gray-100">
          <span>고객센터</span>
          <span className="text-gray-400">›</span>
        </button>
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">앱 버전</div>
          <div className="text-sm text-gray-900 mt-1">1.0.0</div>
        </div>
      </div>

      {/* Logout */}
      <div className="p-4">
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-red-300 text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}