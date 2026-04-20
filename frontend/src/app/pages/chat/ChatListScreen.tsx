import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, Clock } from "lucide-react";
import { BottomNav } from "@/app/components/BottomNav";
import { chatAPI, type Chat } from "@/app/services/api";

export function ChatListScreen() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadChats = async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }

      const result = await chatAPI.getChats();

      if (!mounted) {
        return;
      }

      if (result.error || !result.data) {
        setError(result.error || "채팅방 목록을 불러오지 못했습니다.");
        setChats([]);
      } else {
        setError(null);
        setChats(result.data);
      }

      if (showLoading) {
        setLoading(false);
      }
    };

    void loadChats(true);
    const intervalId = window.setInterval(() => {
      void loadChats(false);
    }, 3000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold">채팅</h1>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-sm text-gray-500">채팅방 목록을 불러오는 중입니다.</div>
      ) : error ? (
        <div className="px-4 py-8 text-sm text-red-500">{error}</div>
      ) : chats.length === 0 ? (
        <div className="px-4 py-8 text-sm text-gray-500">아직 채팅방이 없습니다.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="bg-white px-4 py-4 cursor-pointer hover:bg-gray-50"
            >
              <div className="flex items-start">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{chat.participant.name}</span>
                    <span className="text-xs text-gray-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {chat.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 bg-blue-600 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
