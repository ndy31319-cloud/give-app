import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MapPin, Clock, User, Heart, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

export function PostDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Mock data - ID에 따라 다른 데이터 표시
  const mockPosts: Record<string, any> = {
    "1": {
      id: "1",
      type: "share",
      title: "겨울 외투 나눔",
      description:
        "겨울 옷 정리하다가 새 외투가 나와서 나눔합니다. 사이즈는 100(L)이고, 한 번도 입지 않은 새 옷입니다. 따뜻하고 품질 좋은 외투예요. 필요하신 분께 드립니다.\n\n직거래는 역삼동 인근에서 가능합니다.",
      location: "역삼동",
      time: "1시간 전",
      status: "available",
      author: {
        name: "나눔천사",
        image: null,
        temperature: 38.5,
      },
      images: ["https://images.unsplash.com/photo-1740442535747-6c292f995539?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjBqYWNrZXQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzA1OTA1NzR8MA&ixlib=rb-4.1.0&q=80&w=1080"],
    },
    "2": {
      id: "2",
      type: "need",
      title: "아기 옷 필요해요",
      description:
        "돌 지난 아기 옷이 필요합니다. 겨울옷이면 더 좋고요. 깨끗하게 입을게요. 연락주세요!",
      location: "삼성동",
      time: "3시간 전",
      status: "available",
      author: {
        name: "김민수",
        image: null,
        temperature: 36.5,
      },
      images: ["https://images.unsplash.com/photo-1622290291165-d341f1938b8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWJ5JTIwY2xvdGhlc3xlbnwxfHx8fDE3NzA2MTc0MDV8MA&ixlib=rb-4.1.0&q=80&w=1080"],
    },
    "3": {
      id: "3",
      type: "share",
      title: "생활용품 나눔",
      description:
        "이사 가면서 생활용품 정리합니다. 그릇, 수저, 컵 등 여러 가지 있어요. 필요하신 분들 연락주세요!",
      location: "강남역",
      time: "5시간 전",
      status: "available",
      author: {
        name: "이지은",
        image: null,
        temperature: 39.2,
      },
      images: ["https://images.unsplash.com/photo-1654064756910-974764816931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZWhvbGQlMjBpdGVtc3xlbnwxfHx8fDE3NzA2MTc0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"],
    },
    "4": {
      id: "4",
      type: "share",
      title: "도서 나눔합니다",
      description:
        "책장 정리하면서 읽지 않는 책들 나눔합니다. 소설, 에세이, 자기계발서 등 다양해요. 관심 있으신 분 연락주세요!",
      location: "선릉역",
      time: "1일 전",
      status: "reserved",
      author: {
        name: "박지영",
        image: null,
        temperature: 40.1,
      },
      images: ["https://images.unsplash.com/photo-1542725752-e9f7259b3881?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rcyUyMGVkdWNhdGlvbnxlbnwxfHx8fDE3NzA1OTM1OTB8MA&ixlib=rb-4.1.0&q=80&w=1080"],
    },
    "5": {
      id: "5",
      type: "need",
      title: "노트북 구합니다",
      description:
        "공부용 노트북이 필요합니다. 사양은 낮아도 괜찮아요. 인터넷과 문서 작업만 가능하면 됩니다.",
      location: "논현동",
      time: "2일 전",
      status: "available",
      author: {
        name: "최수진",
        image: null,
        temperature: 37.8,
      },
      images: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYXB0b3B8ZW58MXx8fHwxNzA3MDYxNzQwNnww&ixlib=rb-4.1.0&q=80&w=1080"],
    },
  };

  const post = mockPosts[id || "1"] || {
    id,
    type: "share",
    title: "새 옷 나눔합니다",
    description:
      "겨울 옷 정리하다가 새 옷이 나와서 나눔합니다. 사이즈는 프리사이즈이고, 한 번도 입지 않은 새 옷입니다. 필요하신 분께 드립니다.",
    location: "역삼동",
    time: "10분 전",
    status: "available",
    author: {
      name: "나눔천사",
      image: null,
      temperature: 38.5,
    },
    images: ["https://images.unsplash.com/photo-1740442535747-6c292f995539?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjBqYWNrZXQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzA1OTA1NzR8MA&ixlib=rb-4.1.0&q=80&w=1080"],
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10\">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center space-x-2">
          <button>
            <Share2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Image Section */}
      {post.images && post.images.length > 0 && (
        <div className="w-full h-60 bg-gray-100">
          <ImageWithFallback
            src={post.images[0]}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="px-4 py-6">
        {/* Author Info */}
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-3">
            <User className="w-6 h-6 text-gray-500" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{post.author.name}</div>
            <div className="text-sm text-gray-600">
              {post.location} • 매너온도 {post.author.temperature}°C
            </div>
          </div>
        </div>

        {/* Badge */}
        <Badge
          variant={post.type === "share" ? "default" : "secondary"}
          className={`mb-4 ${post.type === "share" ? "bg-blue-600" : "bg-orange-500"}`}
        >
          {post.type === "share" ? "나눔해요" : "필요해요"}
        </Badge>

        {/* Title & Description */}
        <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-700 mb-6 whitespace-pre-wrap leading-relaxed">{post.description}</p>

        {/* Meta Info */}
        <div className="flex items-center text-sm text-gray-600 space-x-4 mb-6">
          <span className="flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            {post.location}
          </span>
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {post.time}
          </span>
        </div>

        {/* Status Badge */}
        {post.status === "reserved" && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-orange-700">
              ⏰ 이 게시글은 현재 예약중입니다
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-2 py-4 border-t border-gray-200">
          <button className="flex items-center space-x-1 text-gray-600">
            <Heart className="w-5 h-5" />
            <span className="text-sm">관심</span>
          </button>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex space-x-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => navigate(`/chat/${post.id}`)}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          채팅하기
        </Button>
        <Button size="lg" className="flex-1 bg-blue-600 hover:bg-blue-700">
          {post.type === "share" ? "나눔 신청" : "나눔하기"}
        </Button>
      </div>
    </div>
  );
}