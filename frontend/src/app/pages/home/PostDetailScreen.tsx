import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Clock, Heart, MapPin, MessageCircle, User } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { chatAPI, postAPI, type Post } from "@/app/services/api";

export function PostDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const routeState = location.state as { type?: "share" | "need" } | null;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  const postType = useMemo(() => {
    if (routeState?.type) {
      return routeState.type;
    }

    const queryType = searchParams.get("type");
    if (queryType === "share" || queryType === "need") {
      return queryType;
    }

    return null;
  }, [routeState?.type, searchParams]);

  useEffect(() => {
    if (!id) {
      setError("게시글 정보가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    if (!postType) {
      setError("게시글 유형 정보가 없어 상세 내용을 불러올 수 없습니다.");
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadPost = async () => {
      setLoading(true);

      const result = await postAPI.getPost(id, postType);

      if (!mounted) {
        return;
      }

      if (!result.data) {
        setPost(null);
        setError(result.error || "게시글을 불러오지 못했습니다.");
      } else {
        setPost(result.data);
        setError(null);
      }

      setLoading(false);
    };

    void loadPost();

    return () => {
      mounted = false;
    };
  }, [id, postType]);

  const handleStartChat = async () => {
    if (!post || !post.author.id || startingChat) {
      return;
    }

    setStartingChat(true);

    const result = await chatAPI.createRoom({
      name: `${post.author.name}과의 채팅`,
      participantIds: [Number(post.author.id)],
      relatedPostId: post.id,
      relatedPostType: post.type === "share" ? "donate" : "request",
    });

    if (result.error || !result.data) {
      setError(result.error || "채팅방을 만들지 못했습니다.");
      setStartingChat(false);
      return;
    }

    navigate(`/chat/${result.data.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 text-sm text-gray-500">
        게시글을 불러오는 중입니다.
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white px-4 py-8 text-sm text-red-500">
        {error || "게시글을 찾을 수 없습니다."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <button onClick={() => navigate(-1)} type="button">
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {post.images.length > 0 && (
        <div className="aspect-square bg-gray-100">
          <ImageWithFallback
            src={post.images[0]}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="px-4 py-6">
        <div className="mb-6 flex items-center">
          <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
            <User className="h-6 w-6 text-gray-500" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{post.author.name || "사용자"}</div>
            <div className="text-sm text-gray-600">
              {post.location} · 매너온도 {post.author.temperature}
            </div>
          </div>
        </div>

        <Badge
          variant={post.type === "share" ? "default" : "secondary"}
          className={`mb-4 ${post.type === "share" ? "bg-blue-600" : "bg-orange-500"}`}
        >
          {post.type === "share" ? "나눔해요" : "필요해요"}
        </Badge>

        <h1 className="mb-4 text-2xl font-bold">{post.title}</h1>
        <p className="mb-6 whitespace-pre-wrap leading-relaxed text-gray-700">{post.description}</p>

        <div className="mb-6 flex items-center space-x-4 text-sm text-gray-600">
          <span className="flex items-center">
            <MapPin className="mr-1 h-4 w-4" />
            {post.location}
          </span>
          <span className="flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            {post.time}
          </span>
        </div>

        {post.status === "reserved" && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-sm text-orange-700">이 게시글은 현재 예약 중입니다.</p>
          </div>
        )}

        {post.status === "completed" && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm text-gray-700">이 게시글은 거래가 완료되었습니다.</p>
          </div>
        )}

        <div className="flex items-center space-x-2 border-t border-gray-200 py-4">
          <button type="button" className="flex items-center space-x-1 text-gray-600">
            <Heart className="h-5 w-5" />
            <span className="text-sm">관심</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex space-x-2 border-t border-gray-200 bg-white p-4">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => void handleStartChat()}
          disabled={startingChat}
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          {startingChat ? "채팅방 생성 중..." : "채팅하기"}
        </Button>
        <Button size="lg" className="flex-1 bg-blue-600 hover:bg-blue-700">
          {post.type === "share" ? "나눔 요청" : "나눔하기"}
        </Button>
      </div>
    </div>
  );
}
