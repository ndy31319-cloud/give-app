import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPosts } from '../api/client';

const PAGE_SIZE = 4;

function EasyMainScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const categories = [
    { id: 'all', name: '전체' },
    { id: 'digital', name: '가전' },
    { id: 'fashion', name: '의류' },
    { id: 'furniture', name: '가구' },
    { id: 'book', name: '도서' },
  ];

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

  const filteredItems = selectedCategory === 'all'
    ? items
    : items.filter((item) => item.category === selectedCategory);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const visibleSlots = [...pageItems];

  while (visibleSlots.length < PAGE_SIZE) {
    visibleSlots.push(null);
  }

  useEffect(() => {
    setPage(0);
  }, [selectedCategory]);

  const goToNextPage = () => {
    setPage((current) => (current + 1) % pageCount);
  };

  const goToPrevPage = () => {
    setPage((current) => (current - 1 + pageCount) % pageCount);
  };

  const handleReceive = (item) => {
    const isConfirmed = window.confirm('이 물품을 받으시겠습니까?');

    if (isConfirmed) {
      navigate(`/code-login?postId=${item.id || item.post_id}`);
    }
  };

  return (
    <div
      className="bg-[#F8F9FA] h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="bg-[#0047FF] text-white px-12 py-7 flex justify-between items-center shadow-md shrink-0">
        <h1 className="text-[60px] font-bold leading-tight">무료 나눔 키오스크</h1>
        <div className="flex items-center gap-5">
          <div className="bg-white/15 px-8 py-4 rounded-[28px] text-[34px] font-bold">
            {page + 1} / {pageCount}
          </div>
          <button
            onClick={() => navigate('/easy-wanted')}
            className="bg-[#22C55E] text-white px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-[#22C55E] active:bg-green-700"
          >
            물품 요청
          </button>
          <button
            onClick={() => navigate('/buyer-main')}
            className="bg-white text-[#0047FF] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-gray-200"
          >
            일반 화면
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-[#FF4D4D] text-white px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-[#FF4D4D] active:bg-red-700"
          >
            처음으로
          </button>
        </div>
      </div>

      <div className="px-10 py-5 bg-white border-b-4 border-gray-200 flex gap-5 shadow-sm shrink-0">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`flex-1 py-5 rounded-[34px] text-[42px] font-bold border-4 transition-all ${
              selectedCategory === category.id
                ? 'bg-[#0047FF] text-white border-[#0047FF] shadow-md'
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="flex-1 p-8 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[42px] font-bold text-gray-500">
            물품을 불러오는 중입니다
          </div>
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 gap-7 h-full">
            {visibleSlots.map((item, index) => (
              item ? (
                <div
                  key={item.id || item.post_id}
                  className="bg-white rounded-[34px] overflow-hidden shadow-md border-4 border-gray-200 p-7 flex gap-7 active:scale-[0.99] transition-transform h-full min-h-0"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/posts/${item.id || item.post_id}`)}
                    className="w-[260px] h-[260px] self-center bg-gray-100 rounded-[28px] overflow-hidden shrink-0 border-4 border-gray-100 shadow-inner"
                  >
                    <img src={item.image || item.img} alt={item.title} className="w-full h-full object-cover" />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-4 py-2">
                    <h3 className="text-[48px] font-bold text-black leading-tight break-keep truncate">
                      {item.title}
                    </h3>
                    <div className="bg-[#F4F6F8] p-5 rounded-[24px]">
                      <p className="text-[34px] text-gray-600 font-bold truncate">
                        물건: <span className="text-[#0047FF]">{item.title}</span>
                      </p>
                      <p className="text-[26px] text-gray-500 mt-2 leading-tight">
                        사진을 누르면 자세히 볼 수 있어요
                      </p>
                    </div>
                    <button
                      onClick={() => handleReceive(item)}
                      className="w-full bg-[#22C55E] text-white rounded-[24px] text-[38px] font-bold hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm border-b-8 border-green-700 py-4"
                    >
                      물건 받기
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  className="bg-white/60 rounded-[34px] border-4 border-dashed border-gray-200 h-full min-h-0"
                  aria-hidden="true"
                />
              )
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-t-4 border-gray-200 px-10 py-6 flex justify-between items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button
          onClick={goToPrevPage}
          className="bg-gray-100 text-gray-700 px-14 py-5 rounded-[28px] text-[38px] font-bold border-4 border-gray-200 active:scale-95"
        >
          이전장
        </button>
        <p className="text-[34px] text-gray-500 font-bold">
          한 화면에 4개씩 보여드려요
        </p>
        <button
          onClick={goToNextPage}
          className="bg-[#0047FF] text-white px-14 py-5 rounded-[28px] text-[38px] font-bold border-4 border-[#0047FF] shadow-lg active:scale-95"
        >
          다음장
        </button>
      </div>
    </div>
  );
}

export default EasyMainScreen;
