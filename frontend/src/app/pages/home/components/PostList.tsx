import { PostCard } from "@/app/components/PostCard";

interface Post {
  id: string;
  type: "share" | "need";
  title: string;
  location: string;
  time: string;
  image?: string;
  status: "available" | "reserved" | "completed";
}

interface PostListProps {
  posts: Post[];
}

export function PostList({ posts }: PostListProps) {
  return (
    <div className="p-4 space-y-3">
      {posts.map((post) => (
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
      ))}
    </div>
  );
}
