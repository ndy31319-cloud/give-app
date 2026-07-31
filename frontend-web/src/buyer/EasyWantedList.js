import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWantedPosts } from '../api/client';

const PAGE_SIZE = 4;

function EasyWantedList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadWantedPosts() {
      try {
        setIsLoading(true);
        const data = await fetchWantedPosts();
        const nextItems = data.content || data.posts || data || [];

        if (!ignore) {
          setItems(nextItems);
        }
      } catch (error) {
        if (!ignore) {
          alert(`요청 게시판을 불러오지 못했습니다: ${error.message}`);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadWantedPosts();

    return () => {
      ignore = true;
    };
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const visibleSlots = [...pageItems];

  while (visibleSlots.length < PAGE_SIZE) {
    visibleSlots.push(null);
  }

  const goToNextPage = () => {
    setPage((current) => (current + 1) % pageCount);
  };

  const goToPrevPage = () => {
    setPage((current) => (current - 1 + pageCount) % pageCount);
  };

  const handleDonateClick = () => {
    if (window.confirm('이 요청에 나눔을 시작하시겠습니까?')) {
      alert('나눔 의사를 전달했습니다.');
    }
  };

  return (
    <div
      className="easy-screen bg-[#F8F9FA] h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="easy-header bg-[#0047FF] text-white px-12 py-7 flex justify-between items-center shadow-md shrink-0">
        <h1 className="text-[58px] font-bold leading-tight">물품 요청 게시판</h1>
        <div className="easy-header-actions flex items-center gap-5">
          <div className="bg-white/15 px-8 py-4 rounded-[28px] text-[34px] font-bold">
            {page + 1} / {pageCount}
          </div>
          <button
            onClick={() => navigate('/easy-write-wanted')}
            className="bg-[#22C55E] text-white px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-[#22C55E] active:bg-green-700"
          >
            요청 글쓰기
          </button>
          <button
            onClick={() => navigate('/easy-main')}
            className="bg-white text-[#0047FF] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-gray-200"
          >
            물품 목록
          </button>
        </div>
      </div>

      <div className="easy-content flex-1 p-8 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[42px] font-bold text-gray-500">
            요청 글을 불러오는 중입니다
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-10">
            <div className="bg-white rounded-[40px] border-4 border-gray-200 shadow-sm px-12 py-14 max-w-[980px]">
              <p className="text-[46px] font-bold text-gray-900 mb-5">아직 등록된 요청이 없어요</p>
              <p className="text-[32px] font-bold text-gray-600 leading-relaxed mb-9">
                필요한 물품, 급한 정도, 필요한 이유를 적어 요청을 등록해 주세요.
              </p>
              <button
                type="button"
                onClick={() => navigate('/easy-write-wanted')}
                className="bg-[#22C55E] text-white px-12 py-6 rounded-[28px] text-[38px] font-bold border-4 border-[#22C55E] active:bg-green-700"
              >
                요청 글쓰기
              </button>
            </div>
          </div>
        ) : (
          <div className="easy-card-grid grid grid-cols-2 grid-rows-2 gap-7 h-full">
            {visibleSlots.map((item, index) => (
              item ? (
                <div
                  key={item.id}
                  className="easy-wanted-card bg-white rounded-[34px] shadow-md border-4 border-gray-200 p-8 flex flex-col justify-between h-full min-h-0"
                >
                  <div>
                    <div className="inline-flex bg-[#E9F0FF] text-[#0047FF] rounded-[20px] px-6 py-3 text-[28px] font-bold mb-5">
                      {item.status === 'OPEN' ? '요청 중' : '완료'}
                    </div>
                    <h2 className="text-[46px] font-bold text-black leading-tight break-keep mb-5">
                      {item.title}
                    </h2>
                    <p className="text-[30px] text-gray-600 leading-snug line-clamp-3">
                      {item.content || item.description}
                    </p>
                  </div>

                  <button
                    className="w-full bg-[#0047FF] text-white rounded-[24px] text-[36px] font-bold active:scale-[0.98] transition-all py-5"
                    onClick={handleDonateClick}
                  >
                    나눔해주기
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

export default EasyWantedList;
