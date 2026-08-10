import React from 'react';
import { useNavigate } from 'react-router-dom';

function BuyerSelect() {
  const navigate = useNavigate();

  return (
    <div
      className="bg-[#f7f7f4] h-screen flex flex-col items-center justify-center overflow-hidden px-16 relative"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-16 left-16 text-[30px] font-bold text-gray-600 px-8 py-4 rounded-[24px] bg-white border border-gray-100 shadow-sm active:scale-95"
      >
        돌아가기
      </button>

      <div className="text-center mb-24">
        <h1 className="text-[64px] font-bold text-[#333] mb-8">
          나눔 물품을 둘러보세요
        </h1>
        <p className="text-[32px] text-gray-500">
          수령할 때 회원코드를 입력해 인증합니다
        </p>
      </div>

      <div className="w-full max-w-[560px]">
        <button
          type="button"
          onClick={() => navigate('/buyer-main')}
          className="h-[560px] w-full bg-white rounded-[48px] shadow-[0_24px_80px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center active:scale-[0.98] transition-all border border-gray-100"
        >
          <div className="w-48 h-48 rounded-full bg-[#e9f5ee] flex items-center justify-center mb-16">
            <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="text-[56px] font-bold text-[#333] mb-8">물품 보기</h2>
          <p className="text-[28px] text-gray-500 leading-snug">
            로그인 없이<br />나눔 물품을 둘러봅니다
          </p>
        </button>
      </div>
    </div>
  );
}

export default BuyerSelect;
