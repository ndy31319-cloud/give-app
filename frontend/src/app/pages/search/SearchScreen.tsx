import { useState } from "react";
import { BottomNav } from "@/app/components/BottomNav";
import { SearchHeader } from "./components/SearchHeader";
import { SearchFilter } from "./components/SearchFilter";
import { AIImageSearch } from "./components/AIImageSearch";
import { CategoryTabs } from "./components/CategoryTabs";
import { SearchResults } from "./components/SearchResults";

export function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("latest");
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    distance: "all",
  });

  const categories = [
    { id: "all", label: "전체" },
    { id: "clothing", label: "의류" },
    { id: "electronics", label: "전자제품" },
    { id: "furniture", label: "가구" },
    { id: "books", label: "도서" },
    { id: "household", label: "생활용품" },
  ];

  const mockResults = [
    {
      id: "1",
      type: "share",
      title: "겨울 외투 나눔",
      location: "역삼동",
      time: "1시간 전",
      image: "https://images.unsplash.com/photo-1740442535747-6c292f995539?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW50ZXIlMjBqYWNrZXQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzA1OTA1NzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
      status: "available",
      category: "clothing",
    },
    {
      id: "2",
      type: "need",
      title: "아기 옷 필요해요",
      location: "삼성동",
      time: "3시간 전",
      image: "https://images.unsplash.com/photo-1622290291165-d341f1938b8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWJ5JTIwY2xvdGhlc3xlbnwxfHx8fDE3NzA2MTc0MDV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      status: "available",
      category: "clothing",
    },
    {
      id: "3",
      type: "share",
      title: "생활용품 나눔",
      location: "강남역",
      time: "5시간 전",
      image: "https://images.unsplash.com/photo-1654064756910-974764816931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZWhvbGQlMjBpdGVtc3xlbnwxfHx8fDE3NzA2MTc0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      status: "available",
      category: "household",
    },
    {
      id: "4",
      type: "share",
      title: "도서 나눔합니다",
      location: "선릉역",
      time: "1일 전",
      image: "https://images.unsplash.com/photo-1542725752-e9f7259b3881?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rcyUyMGVkdWNhdGlvbnxlbnwxfHx8fDE3NzA1OTM1OTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
      status: "reserved",
      category: "books",
    },
    {
      id: "5",
      type: "need",
      title: "노트북 구합니다",
      location: "논현동",
      time: "2일 전",
      image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYXB0b3B8ZW58MXx8fHwxNzA3MDYxNzQwNnww&ixlib=rb-4.1.0&q=80&w=1080",
      status: "available",
      category: "electronics",
    },
  ];

  // 필터링된 결과
  const filteredResults = mockResults.filter((post) => {
    // 게시글 유형 필터
    if (filters.type !== "all" && post.type !== filters.type) {
      return false;
    }
    // 상태 필터
    if (filters.status !== "all" && post.status !== filters.status) {
      return false;
    }
    // 카테고리 필터
    if (activeCategory !== "all" && post.category !== activeCategory) {
      return false;
    }
    // 검색어 필터
    if (searchQuery && !post.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const applyFilters = () => {
    setFilterOpen(false);
    // 필터 적용 로직은 프론트엔드에서만 처리
  };

  const resetFilters = () => {
    setFilters({
      type: "all",
      status: "all",
      distance: "all",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <SearchHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setFilterOpen(true)}
        onCameraClick={() => setCameraDialogOpen(true)}
      />
      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <SearchFilter
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFilterChange={setFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />
      <AIImageSearch
        open={cameraDialogOpen}
        onOpenChange={setCameraDialogOpen}
      />
      <SearchResults
        posts={filteredResults}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
      <BottomNav />
    </div>
  );
}