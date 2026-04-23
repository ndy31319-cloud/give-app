import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  MoreVertical,
  Send,
  User,
  Plus,
  Camera as CameraIcon,
  Image as ImageIcon,
  MapPin,
  Calendar,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Ban,
  LogOut,
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { chatAPI, type Message } from "@/app/services/api";
import { canUseRealtimeChat, subscribeToRoomMessages } from "@/app/services/firebaseChat";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

export function ChatRoomScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingType, setRatingType] = useState<"positive" | "negative" | null>(null);
  const [ratingComment, setRatingComment] = useState("");

  const participantName = useMemo(() => {
    const otherMessage = messages.find((item) => item.sender === "other");
    return otherMessage ? "상대방" : "채팅 상대";
  }, [messages]);

  useEffect(() => {
    if (!id) {
      setError("채팅방 정보가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadMessages = async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }

      const result = await chatAPI.getMessages(id);

      if (!mounted) {
        return;
      }

      if (result.error || !result.data) {
        setError(result.error || "메시지를 불러오지 못했습니다.");
        setMessages([]);
      } else {
        setError(null);
        setMessages(result.data);
      }

      if (showLoading) {
        setLoading(false);
      }
    };

    const unsubscribe = subscribeToRoomMessages(
      id,
      (nextMessages) => {
        if (!mounted) {
          return;
        }

        setMessages(nextMessages);
        setError(null);
        setLoading(false);
      },
      (subscriptionError) => {
        if (!mounted) {
          return;
        }

        setError(subscriptionError.message || "실시간 메시지를 불러오지 못했습니다.");
        setLoading(false);
      },
    );

    if (!unsubscribe) {
      void loadMessages(true);
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [id]);

  const handleSend = async () => {
    if (!id || !message.trim() || sending) {
      return;
    }

    setSending(true);
    const sendingText = message.trim();
    const result = await chatAPI.sendMessage(id, {
      sender: "me",
      text: sendingText,
      type: "text",
    });

    if (result.error || !result.data) {
      setError(result.error || "메시지 전송에 실패했습니다.");
      setSending(false);
      return;
    }

    if (!canUseRealtimeChat()) {
      setMessages((prev) => [...prev, result.data as Message]);
    }
    setMessage("");
    setError(null);
    setSending(false);
  };

  const handleLeaveRoom = async () => {
    if (!id || leaving) {
      return;
    }

    const shouldLeave = window.confirm("채팅방에서 나가시겠습니까?");
    if (!shouldLeave) {
      return;
    }

    setLeaving(true);
    const result = await chatAPI.leaveRoom(id);

    if (result.error) {
      setError(result.error || "채팅방 나가기에 실패했습니다.");
      setLeaving(false);
      return;
    }

    setMoreMenuOpen(false);
    navigate("/chat");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setProfileDialogOpen(true)}
            className="ml-4 flex items-center hover:bg-gray-50 rounded-lg p-2 transition-colors"
          >
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
              <User className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <div className="font-semibold">{participantName}</div>
              <div className="text-xs text-gray-500">실시간 채팅</div>
            </div>
          </button>
        </div>
        <Sheet open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
          <SheetTrigger asChild>
            <button>
              <MoreVertical className="w-6 h-6" />
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>채팅방 메뉴</SheetTitle>
              <SheetDescription>원하는 작업을 선택해 주세요.</SheetDescription>
            </SheetHeader>
            <div className="py-6 space-y-2">
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  setRatingDialogOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ThumbsUp className="w-5 h-5 text-blue-600" />
                <span>매너 평가하기</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span>신고하기</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors">
                <Ban className="w-5 h-5 text-gray-600" />
                <span>차단하기</span>
              </button>
              <button
                onClick={() => void handleLeaveRoom()}
                disabled={leaving}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-red-600 disabled:opacity-60"
              >
                <LogOut className="w-5 h-5" />
                <span>채팅방 나가기</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500">메시지를 불러오는 중입니다.</div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-500">아직 메시지가 없습니다.</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] ${
                  msg.sender === "me" ? "bg-blue-600 text-white" : "bg-white"
                } rounded-lg px-4 py-2 shadow-sm`}
              >
                {msg.type === "image" && msg.imageUrl ? (
                  <img
                    src={msg.imageUrl}
                    alt="채팅 이미지"
                    className="rounded-md max-h-60 object-cover"
                  />
                ) : (
                  <p>{msg.text}</p>
                )}
                <div
                  className={`text-xs mt-1 ${
                    msg.sender === "me" ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {msg.time}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <Sheet open={plusMenuOpen} onOpenChange={setPlusMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>추가 기능</SheetTitle>
                <SheetDescription>보내고 싶은 항목을 선택해 주세요.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-4 gap-4 py-6">
                <button className="flex flex-col items-center gap-2 p-4 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs">사진</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <CameraIcon className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-xs">카메라</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-xs">위치공유</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 hover:bg-gray-100 rounded-lg transition-colors">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <span className="text-xs">거래약속</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleSend();
              }
            }}
            placeholder="메시지를 입력해 주세요"
            className="flex-1"
          />
          <Button
            onClick={() => void handleSend()}
            size="icon"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={sending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프로필 정보</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <User className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold">{participantName}</h3>
              <p className="text-sm text-gray-500">채팅 상대 정보</p>
            </div>
          </div>
          <Button onClick={() => setProfileDialogOpen(false)} className="w-full">
            닫기
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>매너 평가하기</DialogTitle>
            <DialogDescription>거래 상대에 대한 의견을 남겨주세요.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setRatingType("positive")}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  ratingType === "positive"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <ThumbsUp
                  className={`w-8 h-8 ${
                    ratingType === "positive" ? "text-green-600" : "text-gray-400"
                  }`}
                />
                <span className="font-semibold">좋았어요</span>
              </button>
              <button
                onClick={() => setRatingType("negative")}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  ratingType === "negative"
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <ThumbsDown
                  className={`w-8 h-8 ${
                    ratingType === "negative" ? "text-orange-600" : "text-gray-400"
                  }`}
                />
                <span className="font-semibold">아쉬워요</span>
              </button>
            </div>

            {ratingType && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {ratingType === "positive"
                    ? "어떤 점이 좋았나요?"
                    : "어떤 점이 아쉬웠나요?"}
                </label>
                <Textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="거래 경험을 적어주세요"
                  className="min-h-[100px]"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRatingDialogOpen(false);
                setRatingType(null);
                setRatingComment("");
              }}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              onClick={() => {
                setRatingDialogOpen(false);
                setRatingType(null);
                setRatingComment("");
              }}
              disabled={!ratingType}
              className="flex-1"
            >
              평가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
