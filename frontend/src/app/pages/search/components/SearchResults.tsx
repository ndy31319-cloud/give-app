import { Search } from "lucide-react";
import { PostCard } from "@/app/components/PostCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

interface Post {
  id: string;
  type: "share" | "need";
  title: string;
  location: string;
  time: string;
  image?: string;
  status: "available" | "reserved" | "completed";
}

interface SearchResultsProps {
  posts: Post[];
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export function SearchResults({ posts, sortBy, onSortChange }: SearchResultsProps) {
  return (
    <div className="p-4 space-y-3">
      {/* Sort and Results Count */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          검색 결과 {posts.length}개
        </div>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">최신순</SelectItem>
            <SelectItem value="distance">거리순</SelectItem>
            <SelectItem value="popular">인기순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {posts.length > 0 ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            id={post.id}
            type={post.type}
            title={post.title}
            location={post.location}
            time={post.time}
            image={post.image}
            status={post.status}
          />
        ))
      ) : (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">검색 결과가 없습니다</p>
          <p className="text-sm text-gray-400 mt-2">
            다른 검색어나 필터를 시도해보세요
          </p>
        </div>
      )}
    </div>
  );
}
