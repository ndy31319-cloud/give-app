import React from 'react';
import { useNavigate } from 'react-router-dom';

function BuyerSelect() {
  const navigate = useNavigate();

  return (
    <div
      className="bg-[#F8F9FA] h-screen flex flex-col items-center justify-center overflow-hidden px-16 relative"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-16 left-16 text-[30px] font-bold text-gray-600 px-8 py-4 rounded-[24px] bg-white border border-gray-100 shadow-sm active:scale-95"
      >
        ← 돌아가기
      </button>

      <div className="text-center mb-24">
        <h1 className="text-[64px] font-bold text-[#333] mb-8">
          원하시는 활동을 선택해주세요
        </h1>
        <p className="text-[32px] text-gray-500">
          물품을 먼저 둘러보거나 회원가입을 할 수 있어요
        </p>
      </div>

      <div className="grid grid-cols-2 gap-16 w-full max-w-[1180px]">
        <button
          type="button"
          onClick={() => navigate('/buyer-main')}
          className="h-[560px] bg-white rounded-[48px] shadow-[0_24px_80px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center active:scale-[0.98] transition-all border border-gray-100"
        >
          <div className="w-48 h-48 rounded-full bg-[#E9F0FF] flex items-center justify-center mb-16">
            <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#0047FF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="text-[56px] font-bold text-[#333] mb-8">물품보기</h2>
          <p className="text-[28px] text-gray-500 leading-snug">
            로그인 없이<br />나눔 물품을 둘러봅니다
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate('/signup-buyer')}
          className="h-[560px] bg-white rounded-[48px] shadow-[0_24px_80px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center active:scale-[0.98] transition-all border border-gray-100"
        >
          <div className="w-48 h-48 rounded-full bg-[#EAFBF1] flex items-center justify-center mb-16">
            <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6" />
              <path d="M22 11h-6" />
            </svg>
          </div>
          <h2 className="text-[56px] font-bold text-[#333] mb-8">회원가입</h2>
          <p className="text-[28px] text-gray-500 leading-snug">
            가입 후 회원코드를<br />발급받습니다
          </p>
        </button>
      </div>
    </div>
  );
}

export default BuyerSelect;
