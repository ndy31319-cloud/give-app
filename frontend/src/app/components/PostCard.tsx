import { MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/app/components/ui/badge";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

interface PostCardProps {
  id: string;
  type: "share" | "need";
  title: string;
  location: string;
  time: string;
  image?: string;
  status?: "available" | "reserved" | "completed";
}

export function PostCard({ id, type, title, location, time, image, status }: PostCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/post/${id}`)}
      className="bg-white rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <Badge
              variant={type === "share" ? "default" : "secondary"}
              className={type === "share" ? "bg-blue-600" : "bg-orange-500"}
            >
              {type === "share" ? "나눔해요" : "필요해요"}
            </Badge>
            {status === "reserved" && <Badge variant="outline">예약중</Badge>}
            {status === "completed" && <Badge variant="outline">나눔완료</Badge>}
          </div>
          <h3 className="font-semibold mb-2">{title}</h3>
          <div className="flex items-center text-sm text-gray-600 space-x-3">
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {location}
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {time}
            </span>
          </div>
        </div>
        {image && (
          <div className="w-20 h-20 flex-shrink-0">
            <ImageWithFallback
              src={image}
              alt={title}
              className="w-full h-full object-cover rounded-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}
