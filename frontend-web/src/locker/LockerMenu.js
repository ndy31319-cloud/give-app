import React from 'react';
import { useNavigate } from 'react-router-dom';

function LockerMenu() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-screen bg-[#F8FAF7] p-10 flex items-center justify-center"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <section className="w-full max-w-[1120px] rounded-[36px] bg-white border border-[#E2E8DE] p-10 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-10 text-[24px] font-bold text-gray-500 active:scale-95"
        >
          ← 처음으로
        </button>

        <div className="mb-12 text-center">
          <p className="mb-4 text-[26px] font-black text-[#2E8B57]">물품보관함</p>
          <h1 className="text-[64px] font-black leading-tight text-[#17211B] word-keep">
            무엇을 하시겠어요?
          </h1>
          <p className="mt-5 text-[28px] font-bold leading-snug text-[#69756D] word-keep">
            물품을 찾거나, 후원 물품을 보관함에 넣을 수 있어요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <button
            type="button"
            onClick={() => navigate('/code-login?mode=locker-pickup')}
            className="min-h-[360px] rounded-[32px] bg-[#0047FF] p-10 text-left text-white shadow-[0_20px_60px_rgba(0,71,255,0.18)] active:scale-[0.98]"
          >
            <div className="mb-9 flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-[52px] font-black">
              1
            </div>
            <h2 className="mb-5 text-[52px] font-black leading-tight word-keep">물품 찾기</h2>
            <p className="text-[28px] font-bold leading-snug text-white/85 word-keep">
              회원코드를 입력하고 내 물품을 받아요.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/locker/store')}
            className="min-h-[360px] rounded-[32px] bg-[#2E8B57] p-10 text-left text-white shadow-[0_20px_60px_rgba(46,139,87,0.18)] active:scale-[0.98]"
          >
            <div className="mb-9 flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-[52px] font-black">
              2
            </div>
            <h2 className="mb-5 text-[52px] font-black leading-tight word-keep">물품 보관하기</h2>
            <p className="text-[28px] font-bold leading-snug text-white/85 word-keep">
              후원자 앱의 QR을 스캔하고 보관함에 물품을 넣어요.
            </p>
          </button>
        </div>
      </section>
    </main>
  );
}

export default LockerMenu;
