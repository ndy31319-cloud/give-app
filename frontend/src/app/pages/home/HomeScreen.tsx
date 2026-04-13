import { useEffect, useState } from "react";
import { BottomNav } from "@/app/components/BottomNav";
import { TabBar } from "@/app/components/TabBar";
import { HomeHeader } from "./components/HomeHeader";
import { PostList } from "./components/PostList";
import { FloatingWriteButton } from "./components/FloatingWriteButton";
import { postAPI, type Post } from "@/app/services/api";

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"all" | "share" | "need">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);

      const result = await postAPI.getPosts();

      if (result.error || !result.data) {
        setError(result.error || "게시글을 불러오지 못했습니다.");
        setPosts([]);
      } else {
        setError("");
        setPosts(result.data);
      }

      setLoading(false);
    };

    loadPosts();
  }, []);

  const tabs = [
    { id: "all", label: "전체" },
    { id: "share", label: "나눔해요" },
    { id: "need", label: "필요해요" },
  ];

  const filteredPosts = posts.filter((post) => {
    if (activeTab === "all") return true;
    return post.type === activeTab;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <HomeHeader />
      <TabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as "all" | "share" | "need")}
      />
      {loading ? (
        <div className="p-6 text-center text-gray-500">게시글을 불러오는 중...</div>
      ) : error ? (
        <div className="p-6 text-center text-red-500">{error}</div>
      ) : (
        <PostList posts={filteredPosts} />
      )}
      <FloatingWriteButton />
      <BottomNav />
    </div>
  );
}
