import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPosts } from '../api/client';
import PostImage from './PostImage';
import ReceiveConfirmModal from './ReceiveConfirmModal';
import { getItemCategory, isDonatePost as isVisibleDonatePost } from './postListUtils';

const PAGE_SIZE = 4;
const MAIN_CATEGORY_IDS = ['clothing', 'electronics', 'household'];

function EasyMainScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingReceiveItem, setPendingReceiveItem] = useState(null);

  const categories = [
    { id: 'all', name: '전체' },
    { id: 'clothing', name: '옷' },
    { id: 'electronics', name: '전자제품' },
    { id: 'household', name: '생활용품' },
    { id: 'other', name: '그 외' },
  ];

  useEffect(() => {
    let ignore = false;

    async function loadPosts() {
      try {
        setIsLoading(true);
        setLoadError('');
        const data = await fetchPosts();
        const nextItems = data.content || data.posts || data || [];

        if (!ignore) {
          setItems(nextItems);
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(`물품을 불러오지 못했습니다. ${error.message}`);
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
  const getItemTitle = (item) => item.title || item.name || '이름 없는 물품';
  const getItemDescription = (item) => (
    item.description ||
    item.content ||
    item.detail ||
    '상품설명이 없습니다.'
  );

  const isDonatePost = (item) => {
    const postType = getPostType(item);
    return isVisibleDonatePost({ ...item, post_type: postType });
  };

  const donateItems = items.filter(isDonatePost);
  const filteredItems = selectedCategory === 'all'
    ? donateItems
    : donateItems.filter((item) => {
      const category = getItemCategory(item);
      return selectedCategory === 'other'
        ? !MAIN_CATEGORY_IDS.includes(category)
        : category === selectedCategory;
    });

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
    setPendingReceiveItem(item);
  };

  const confirmReceive = () => {
    if (!pendingReceiveItem) {
      return;
    }

    navigate(`/code-login?postId=${getPostId(pendingReceiveItem)}&type=${getPostType(pendingReceiveItem)}&easy=1`);
  };

  return (
    <div
      className="easy-screen easy-main-screen bg-[#f7f7f4] h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <div className="easy-header easy-main-header bg-[#2f7d4f] text-white px-12 py-7 flex justify-between items-center shadow-md shrink-0">
        <div className="easy-main-heading">
          <h1 className="text-[60px] font-bold leading-tight">쉬운 나눔</h1>
          <p>사진을 보고 필요한 물건을 고르세요</p>
        </div>
        <div className="easy-header-actions flex items-center gap-5">
          <div className="bg-white/15 px-8 py-4 rounded-[28px] text-[34px] font-bold" aria-label="현재 쪽수">
            {page + 1} / {pageCount}
          </div>
          <button
            type="button"
            onClick={() => navigate('/easy-wanted')}
            className="easy-header-secondary-button bg-[#f3fbf6] text-[#177245] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-white"
          >
            요청하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/buyer-main')}
            className="bg-white text-[#2f7d4f] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-gray-200"
          >
            일반화면
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-[#d64545] text-white px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-[#d64545] active:bg-red-700"
          >
            처음으로
          </button>
        </div>
      </div>

      <div className="easy-category-bar easy-main-category-bar px-8 py-4 bg-white border-b-4 border-gray-200 grid gap-3 shadow-sm shrink-0">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={`h-[78px] rounded-[26px] text-[25px] font-bold border-4 transition-all break-keep ${
              selectedCategory === category.id
                ? 'bg-[#2f7d4f] text-white border-[#2f7d4f] shadow-md'
                : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="easy-content flex-1 p-8 overflow-hidden">
        {isLoading ? (
          <div className="easy-main-message h-full flex flex-col items-center justify-center text-center">
            <strong>물품을 불러오는 중입니다</strong>
          </div>
        ) : loadError ? (
          <div className="easy-main-message h-full flex flex-col items-center justify-center text-center">
            <strong>물품을 불러오지 못했습니다</strong>
            <p>{loadError}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="easy-main-message h-full flex flex-col items-center justify-center text-center">
            <strong>보여드릴 물품이 없습니다</strong>
            <p>다른 분류를 눌러보세요</p>
          </div>
        ) : (
          <div className="easy-card-grid grid grid-cols-2 grid-rows-2 gap-7 h-full">
            {visibleSlots.map((item, index) => (
              item ? (
                <div
                  key={getPostId(item)}
                  className="easy-post-card easy-main-card bg-white rounded-[34px] overflow-hidden shadow-md border-4 border-gray-200 p-7 active:scale-[0.99] transition-transform h-full min-h-0"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/posts/${getPostId(item)}?type=${getPostType(item)}&easy=1`, { state: { fallbackPost: item, fromEasyMode: true } })}
                    className="easy-post-thumb bg-gray-100 rounded-[28px] overflow-hidden shrink-0 border-4 border-gray-100 shadow-inner"
                    aria-label={`${getItemTitle(item)} 자세히 보기`}
                  >
                    <PostImage item={item} alt={getItemTitle(item)} className="w-full h-full object-cover" />
                  </button>

                  <div className="easy-post-info min-w-0 flex flex-col gap-4">
                    <h3 className="text-[48px] font-bold text-black leading-tight break-keep">
                      {getItemTitle(item)}
                    </h3>
                    <div className="easy-main-card-note bg-[#f7f7f4] p-5 rounded-[24px]">
                      <p className="text-[34px] text-gray-700 font-bold">
                        {getItemDescription(item)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReceive(item)}
                    className="easy-receive-button w-full bg-[#2f7d4f] text-white rounded-[24px] text-[38px] font-bold hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm border-b-8 border-green-700 py-4"
                  >
                    이 물건 받기
                  </button>
                </div>
              ) : (
                <div
                  key={`empty-${index}`}
                  className="easy-empty-card bg-white/60 rounded-[34px] border-4 border-dashed border-gray-200 h-full min-h-0"
                  aria-hidden="true"
                />
              )
            ))}
          </div>
        )}
      </div>

      <div className="easy-footer bg-white border-t-4 border-gray-200 px-10 py-6 flex justify-between items-center shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <button
          type="button"
          onClick={goToPrevPage}
          className="bg-gray-100 text-gray-700 px-14 py-5 rounded-[28px] text-[38px] font-bold border-4 border-gray-200 active:scale-95"
        >
          이전
        </button>
        <p className="text-[34px] text-gray-500 font-bold">
          한 화면에 4개씩 보여드려요
        </p>
        <button
          type="button"
          onClick={goToNextPage}
          className="bg-[#2f7d4f] text-white px-14 py-5 rounded-[28px] text-[38px] font-bold border-4 border-[#2f7d4f] shadow-lg active:scale-95"
        >
          다음
        </button>
      </div>

      <ReceiveConfirmModal
        open={Boolean(pendingReceiveItem)}
        onCancel={() => setPendingReceiveItem(null)}
        onConfirm={confirmReceive}
      />
    </div>
  );
}

export default EasyMainScreen;
