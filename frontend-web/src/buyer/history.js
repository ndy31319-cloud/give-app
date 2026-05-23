import React from 'react';
import { useNavigate } from 'react-router-dom';

function History() {
  const navigate = useNavigate();

  return (
    <div
      className="p-8 bg-[#F8F9FA] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate('/mypage-buyer')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[36px] font-bold text-[#333]">나눔 이용 내역</h1>
      </div>

      <div className="bg-white rounded-[32px] p-16 text-center border border-gray-100">
        <p className="text-[28px] font-bold text-gray-500">이용 내역이 없습니다.</p>
      </div>
    </div>
  );
}

export default History;
