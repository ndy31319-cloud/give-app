import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPosts } from './api/client';
import PostImage from './buyer/PostImage';
import { getItemCategory, isDonatePost as isVisibleDonatePost } from './buyer/postListUtils';

function MainScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const categories = useMemo(() => [
    { id: 'all', name: '전체' },
    { id: 'clothing', name: '의류' },
    { id: 'electronics', name: '전자제품' },
    { id: 'furniture', name: '가구' },
    { id: 'books', name: '도서' },
    { id: 'household', name: '생활용품' },
    { id: 'baby', name: '육아용품' },
    { id: 'kitchen', name: '주방용품' },
    { id: 'digital', name: '디지털기기' },
  ], []);

  useEffect(() => {
    let ignore = false;

    async function loadPosts() {
      try {
        setIsLoading(true);
        const data = await fetchPosts();
        const nextItems = data.content || data.posts || data || [];

        if (!ignore) {
          setItems(nextItems);
        }
      } catch (error) {
        if (!ignore) {
          alert(`물품 목록을 불러오지 못했습니다: ${error.message}`);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      ignore = true;
    };
  }, []);

  const getPostId = (item) => item.post_id || item.postId || item.recordId || item.id;
  const getPostType = (item) => item.post_type || item.postType || item.type || 'donate';
  const isDonatePost = (item) => {
    const postType = getPostType(item);
    return isVisibleDonatePost({ ...item, post_type: postType });
  };

  const donateItems = items.filter(isDonatePost);
  const filteredItems = selectedCategory === 'all'
    ? donateItems
    : donateItems.filter((item) => getItemCategory(item) === selectedCategory);

  const currentCategoryName = categories.find((category) => category.id === selectedCategory)?.name;

  return (
    <div
      className="buyer-screen bg-[#f7f7f4] h-screen flex overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="buyer-sidebar w-[260px] bg-[#2f7d4f] flex flex-col shadow-2xl z-10 shrink-0">
        <div className="p-8 border-b border-white/20">
          <h1 className="text-[28px] font-bold text-white leading-tight">나눔<br />플랫폼</h1>
        </div>

        <div className="flex-1 py-6">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`w-full text-left pl-7 py-3.5 text-[20px] font-bold transition-all relative ${
                selectedCategory === category.id
                  ? 'bg-[#f7f7f4] text-[#2f7d4f] rounded-l-[30px] ml-4 w-[calc(100%-16px)] shadow-[-5px_0_15px_rgba(0,0,0,0.1)]'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/20 text-white py-4 rounded-2xl font-bold text-[18px] hover:bg-white/30 active:scale-95 transition-all"
          >
            처음으로
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative min-w-0">
        <div className="buyer-topbar px-10 py-8 flex justify-between items-end border-b border-gray-200 bg-white shadow-sm shrink-0">
          <h2 className="text-[36px] font-bold text-[#333] border-b-4 border-[#2f7d4f] pb-2 inline-block">
            {currentCategoryName}
          </h2>

          <div className="buyer-topbar-actions flex items-center gap-4 pb-2">
            <p className="text-[22px] text-gray-500 font-bold">
              물품을 선택하면 상세 정보를 볼 수 있어요
            </p>
            <button
              type="button"
              onClick={() => navigate('/easy-main')}
              className="bg-[#2f7d4f] text-white px-8 py-4 rounded-[24px] text-[24px] font-bold shadow-lg active:scale-95"
            >
              쉬운화면
            </button>
          </div>
        </div>

        <div className="main-content flex-1 overflow-hidden p-10 bg-[#f7f7f4]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-[28px] font-bold text-gray-500">
              물품을 불러오는 중입니다...
            </div>
          ) : (
            <div className="main-post-grid grid grid-cols-3 gap-6 pb-24">
              {filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.id || item.post_id}
                  onClick={() => navigate(`/posts/${getPostId(item)}?type=${getPostType(item)}`, { state: { fallbackPost: item } })}
                  className="main-post-card text-left bg-white rounded-[24px] overflow-hidden shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="post-thumb bg-gray-100 relative">
                    <PostImage item={item} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6">
                    <h3 className="text-[22px] font-bold text-[#333] mb-2 truncate">{item.title}</h3>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="buyer-bottom-actions absolute bottom-0 right-0 w-full bg-white border-t border-gray-200 p-6 flex justify-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => navigate('/wanted')}
            className="bg-[#e9f5ee] text-[#2f7d4f] px-8 py-4 rounded-2xl flex items-center gap-2 text-[20px] font-bold active:scale-95 transition-all"
          >
            나눔 요청
          </button>

          <button
            onClick={() => navigate('/mypage-buyer')}
            className="hidden bg-[#2f7d4f] text-white px-8 py-4 rounded-2xl items-center gap-2 text-[20px] font-bold active:scale-95 transition-all shadow-lg"
          >
            마이페이지
          </button>
        </div>
      </div>
    </div>
  );
}

export default MainScreen;
