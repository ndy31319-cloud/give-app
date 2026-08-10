import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyPosts } from '../api/client';

function readPosts(payload) {
  const data = payload?.data || payload || {};
  return data.posts || payload?.posts || [];
}

function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadHistory() {
      try {
        setIsLoading(true);
        const result = await fetchMyPosts();
        if (!ignore) {
          setItems(readPosts(result));
        }
      } catch {
        if (!ignore) {
          setItems([]);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div
      className="p-8 bg-[#f7f7f4] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/mypage-buyer')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[36px] font-bold text-[#333]">나눔 이용 내역</h1>
        </div>
        <span className="text-[20px] text-[#2f7d4f] font-bold">전체 {items.length}개</span>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-[32px] p-16 text-center border border-gray-100">
          <p className="text-[28px] font-bold text-gray-500">이용 내역을 불러오는 중입니다.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-[32px] p-16 text-center border border-gray-100">
          <p className="text-[28px] font-bold text-gray-500">이용 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <button
              type="button"
              key={`${item.post_type || item.postType}-${item.post_id || item.postId}`}
              onClick={() => navigate(`/posts/${item.post_id || item.postId}?type=${item.post_type || item.postType || 'donate'}`)}
              className="w-full bg-white p-8 rounded-[28px] border border-gray-100 flex justify-between items-center text-left active:scale-[0.99] transition-all hover:bg-gray-50"
            >
              <div>
                <p className="text-[24px] font-bold text-[#333]">{item.title}</p>
                <p className="text-[18px] text-gray-400 mt-2">
                  {(item.post_type || item.postType) === 'request' ? '요청 글' : '나눔 글'} · {item.status || '상태 없음'}
                </p>
              </div>
              <span className="text-[22px] font-bold text-[#2f7d4f]">보기</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default History;
