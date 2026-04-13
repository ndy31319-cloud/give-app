import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

interface ShareItem {
  id: string;
  title: string;
  date: string;
  status: "completed" | "inProgress";
  image: string;
  review?: {
    message: string;
    rating: number;
    from: string;
  };
}

export function MySharesScreen() {
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<ShareItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const myShares: ShareItem[] = [
    {
      id: "1",
      title: "겨울 외투 나눔",
      date: "2025.01.15",
      status: "completed",
      image: "https://images.unsplash.com/photo-1740442535747-6c292f995539?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjBqYWNrZXQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzA1OTA1NzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
      review: {
        message: "정말 따뜻한 외투 감사합니다! 추운 겨울 잘 보낼 수 있을 것 같아요. 좋은 분 덕분에 큰 도움을 받았습니다. 다시 한번 감사드립니다 😊",
        rating: 5,
        from: "김민수님",
      },
    },
    {
      id: "2",
      title: "생활용품 나눔",
      date: "2025.01.20",
      status: "completed",
      image: "https://images.unsplash.com/photo-1654064756910-974764816931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZWhvbGQlMjBpdGVtc3xlbnwxfHx8fDE3NzA2MTc0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      review: {
        message: "필요한 물건들을 나눠주셔서 정말 감사합니다. 덕분에 새 출발을 할 수 있게 되었어요. 항상 건강하시고 행복하세요! 💕",
        rating: 5,
        from: "이지은님",
      },
    },
    {
      id: "3",
      title: "도서 나눔",
      date: "2025.02.01",
      status: "completed",
      image: "https://images.unsplash.com/photo-1542725752-e9f7259b3881?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rcyUyMGVkdWNhdGlvbnxlbnwxfHx8fDE3NzA1OTM1OTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
      review: {
        message: "아이가 책을 너무 좋아해서 정말 기뻐했어요. 소중한 책들 나눠주셔서 감사합니다. 아이와 함께 즐겁게 읽을게요! 🙏",
        rating: 5,
        from: "박지영님",
      },
    },
    {
      id: "4",
      title: "기부 물품",
      date: "2025.02.05",
      status: "inProgress",
      image: "https://images.unsplash.com/photo-1591522810850-58128c5fb089?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb25hdGlvbiUyMGNoYXJpdHklMjBpdGVtc3xlbnwxfHx8fDE3NzA2MTg0MTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    {
      id: "5",
      title: "의류 나눔",
      date: "2025.02.08",
      status: "inProgress",
      image: "https://images.unsplash.com/photo-1657878337917-48ec0248bdd6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXN1YWwlMjBjbG90aGVzfGVufDF8fHx8MTc3MDYxNzQwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    },
  ];

  const handleItemClick = (item: ShareItem) => {
    if (item.status === "completed" && item.review) {
      setSelectedItem(item);
      setDialogOpen(true);
    } else if (item.status === "inProgress") {
      // 진행중인 나눔은 게시물 상세로 이동
      navigate(`/post/${item.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate("/mypage")} className="mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">나의 나눔/활동</h1>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm opacity-90">총 나눔 횟수</div>
            <div className="text-3xl font-bold">12회</div>
          </div>
          <Heart className="w-16 h-16 opacity-30" />
        </div>
        <div className="text-sm opacity-90">
          여러분의 따뜻한 마음이 누군가에게 큰 힘이 됩니다 ❤️
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {myShares.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`bg-white rounded-lg p-4 shadow-sm transition-all ${
              item.status === "completed" && item.review
                ? "cursor-pointer hover:shadow-md hover:border-2 hover:border-blue-200"
                : ""
            }`}
          >
            <div className="flex gap-3">
              <div className="w-20 h-20 flex-shrink-0">
                <ImageWithFallback
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover rounded-md"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge
                    variant={
                      item.status === "completed" ? "default" : "secondary"
                    }
                    className={
                      item.status === "completed"
                        ? "bg-green-600"
                        : "bg-orange-500"
                    }
                  >
                    {item.status === "completed" ? "나눔완료" : "진행중"}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">{item.date}</div>
                {item.status === "completed" && item.review && (
                  <div className="text-sm text-blue-600 mt-2 flex items-center">
                    <Heart className="w-4 h-4 mr-1" />
                    후기 보기
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedItem && selectedItem.review && (
            <>
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="text-center text-xl">
                  💝 감사 메시지
                </DialogTitle>
                <DialogDescription className="text-center">
                  {selectedItem.review.from}께서 보내주신 따뜻한 마음
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-6">
                {/* Stars */}
                <div className="flex justify-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-8 h-8 ${
                        i < selectedItem.review!.rating
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300 fill-gray-300"
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                {/* Message */}
                <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl p-6 relative">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                    💌
                  </div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedItem.review.message}
                  </p>
                </div>

                {/* From */}
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedItem.review.from}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t pt-4 text-center">
                <p className="text-sm text-gray-600">
                  여러분의 작은 나눔이 세상을 더 따뜻하게 만듭니다 🌟
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}