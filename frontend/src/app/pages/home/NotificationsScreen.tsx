import { useNavigate } from "react-router";
import { ArrowLeft, Bell } from "lucide-react";

interface Notification {
  id: string;
  type: "share" | "chat" | "system";
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}

export function NotificationsScreen() {
  const navigate = useNavigate();

  const mockNotifications: Notification[] = [
    {
      id: "1",
      type: "chat",
      title: "새로운 채팅 메시지",
      message: "나눔천사님이 메시지를 보냈습니다.",
      time: "5분 전",
      isRead: false,
    },
    {
      id: "2",
      type: "share",
      title: "나눔 신청 완료",
      message: "겨울 외투 나눔이 예약되었습니다.",
      time: "1시간 전",
      isRead: false,
    },
    {
      id: "3",
      type: "system",
      title: "나눔 완료",
      message: "생활용품 나눔이 완료되었습니다. 따뜻한 나눔 감사합니다!",
      time: "3시간 전",
      isRead: true,
    },
    {
      id: "4",
      type: "chat",
      title: "새로운 채팅",
      message: "도움이필요해님이 채팅을 시작했습니다.",
      time: "1일 전",
      isRead: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">알림</h1>
      </div>

      <div className="divide-y divide-gray-100">
        {mockNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-4 hover:bg-gray-50 cursor-pointer ${
              !notification.isRead ? "bg-blue-50" : "bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notification.type === "chat"
                    ? "bg-blue-100"
                    : notification.type === "share"
                    ? "bg-green-100"
                    : "bg-gray-100"
                }`}
              >
                <Bell
                  className={`w-5 h-5 ${
                    notification.type === "chat"
                      ? "text-blue-600"
                      : notification.type === "share"
                      ? "text-green-600"
                      : "text-gray-600"
                  }`}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-800">
                    {notification.title}
                  </h3>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {notification.message}
                </p>
                <span className="text-xs text-gray-500">{notification.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
