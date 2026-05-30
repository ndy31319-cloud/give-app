import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWantedPosts } from '../api/client';

function WantedList() {
  const navigate = useNavigate();
  const [wantedItems, setWantedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadWantedPosts() {
      try {
        setIsLoading(true);
        const data = await fetchWantedPosts();
        const nextItems = data.content || data.posts || data || [];

        if (!ignore) {
          setWantedItems(nextItems);
        }
      } catch (error) {
        if (!ignore) {
          alert(`요청 게시글을 불러오지 못했습니다: ${error.message}`);
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

  const handleDonateClick = () => {
    if (window.confirm('이 요청에 나눔을 시작하시겠습니까?')) {
      alert('나눔 의사를 전달했습니다.');
    }
  };

  return (
    <div
      className="p-8 bg-[#F8F9FA] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/buyer-main')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[36px] font-bold text-[#333]">나눔 요청 게시판</h1>
        </div>

        <button
          onClick={() => navigate('/write-wanted')}
          className="bg-[#0047FF] text-white px-8 py-4 rounded-[20px] flex items-center gap-3 text-[20px] font-bold shadow-lg shadow-blue-100 active:scale-95 transition-all hover:bg-blue-700"
        >
          물품 요청하기
        </button>
      </div>

      <div className="bg-blue-50 p-6 rounded-[24px] mb-10 flex items-center gap-4 border border-blue-100">
        <p className="text-blue-700 text-[18px] font-medium">
          필요한 물품을 요청하면 나눔 가능한 사람이 확인할 수 있어요.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <p className="text-[20px] font-bold text-[#333]">게시글을 불러오는 중입니다...</p>
        </div>
      ) : wantedItems.length === 0 ? (
        <div className="bg-white rounded-[32px] p-16 text-center border border-gray-100">
          <p className="text-[28px] font-bold text-gray-500">등록된 요청 게시글이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {wantedItems.map((item) => (
            <div key={item.id} className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 transition-all active:scale-[0.98]">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-green-100 text-green-600 px-4 py-1 rounded-full font-bold text-[14px]">
                  {item.status === 'OPEN' ? '요청 중' : '완료'}
                </span>
              </div>

              <h3 className="text-[26px] font-bold text-[#333] mb-2">{item.title}</h3>
              <p className="text-gray-500 text-[18px] mb-6 leading-relaxed">
                {item.content || item.description}
              </p>

              <div className="flex justify-end border-t pt-6">
                <button
                  onClick={handleDonateClick}
                  className="text-[#0047FF] font-bold text-[18px] border-2 border-[#0047FF] px-6 py-2 rounded-xl active:bg-blue-50 transition-all"
                >
                  나눔해주기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WantedList;
