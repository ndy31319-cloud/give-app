import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWantedPosts, hasAuthToken } from '../api/client';
import { getPostId, getSentDonationRequestIds, isRequestOpen, saveDonationInterest } from './postListUtils';

const PAGE_SIZE = 4;

function getWantedSummary(item) {
  const summary = item?.content || item?.description || item?.detail || item?.itemName || item?.item_name || item?.title;
  return String(summary || '필요한 물품을 요청했어요').trim();
}

function EasyWantedList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sentRequestIds, setSentRequestIds] = useState(() => getSentDonationRequestIds());

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

  const visibleItems = items.filter((item) => !sentRequestIds.has(String(getPostId(item))));
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const pageItems = visibleItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
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

  const handleDonateClick = (item) => {
    if (!isRequestOpen(item)) {
      return;
    }

    if (!hasAuthToken()) {
      alert('나눔 의사를 전달하려면 회원코드 인증이 필요합니다.');
      navigate('/code-login?mode=donation-intent&easy=1');
      return;
    }

    if (window.confirm('이 요청에 나눔을 시작하시겠습니까?')) {
      alert('나눔 의사를 전달했습니다.');
      const requestId = saveDonationInterest(item);
      if (requestId) {
        setSentRequestIds((currentIds) => new Set([...currentIds, requestId]));
      }
    }
  };

  return (
    <div
      className="easy-screen bg-[#f7f7f4] h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="easy-header bg-[#2f7d4f] text-white px-12 py-7 flex justify-between items-center shadow-md shrink-0">
        <h1 className="text-[58px] font-bold leading-tight">물품 요청 게시판</h1>
        <div className="easy-header-actions flex items-center gap-5">
          <div className="bg-white/15 px-8 py-4 rounded-[28px] text-[34px] font-bold">
            {page + 1} / {pageCount}
          </div>
          <button
            onClick={() => navigate('/easy-write-wanted')}
            className="easy-header-secondary-button bg-[#f3fbf6] text-[#177245] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-white"
          >
            요청 글쓰기
          </button>
          <button
            onClick={() => navigate('/easy-main')}
            className="bg-white text-[#2f7d4f] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-gray-200"
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
        ) : visibleItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-10">
            <div className="bg-white rounded-[40px] border-4 border-gray-200 shadow-sm px-12 py-14 max-w-[980px]">
              <p className="text-[46px] font-bold text-gray-900 mb-5">아직 등록된 요청이 없어요</p>
              <p className="text-[32px] font-bold text-gray-600 leading-relaxed mb-9">
                필요한 물품, 급한 정도, 필요한 이유를 적어 요청을 등록해 주세요.
              </p>
              <button
                type="button"
                onClick={() => navigate('/easy-write-wanted')}
                className="bg-[#2f7d4f] text-white px-12 py-6 rounded-[28px] text-[38px] font-bold border-4 border-[#2f7d4f] active:bg-green-700"
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
                    <div className="inline-flex bg-[#e9f5ee] text-[#2f7d4f] rounded-[20px] px-6 py-3 text-[28px] font-bold mb-5">
                      {isRequestOpen(item) ? '요청 중' : '완료'}
                    </div>
                    <h2 className="text-[46px] font-bold text-black leading-tight break-keep mb-5">
                      {getWantedSummary(item)}
                    </h2>
                    <p className="text-[30px] text-gray-600 leading-snug line-clamp-3">
                      {item.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!isRequestOpen(item)}
                    className={`w-full rounded-[24px] text-[36px] font-bold transition-all py-5 ${
                      isRequestOpen(item)
                        ? 'bg-[#2f7d4f] text-white active:scale-[0.98]'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                    onClick={() => handleDonateClick(item)}
                  >
                    {isRequestOpen(item) ? '나눔해주기' : '나눔 완료'}
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
          className="bg-[#2f7d4f] text-white px-14 py-5 rounded-[28px] text-[38px] font-bold border-4 border-[#2f7d4f] shadow-lg active:scale-95"
        >
          다음장
        </button>
      </div>
    </div>
  );
}

export default EasyWantedList;
