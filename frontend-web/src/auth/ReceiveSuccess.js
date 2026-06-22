import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REDIRECT_SECONDS = 6;

function ReceiveSuccess() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      navigate('/', { replace: true });
    }, REDIRECT_SECONDS * 1000);

    const countdownTimer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [navigate]);

  return (
    <main
      className="receive-success-screen bg-[#F9FAFB] h-screen w-screen flex items-center justify-center overflow-hidden px-8"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <section className="w-full max-w-[760px] text-center flex flex-col items-center">
        <div className="relative w-[320px] h-[320px] max-w-[58vw] max-h-[58vw] mb-12">
          <div className="absolute inset-0 rounded-full bg-[#E9F0FF] receive-success-pulse" />
          <div className="absolute inset-[34px] rounded-full bg-white shadow-[0_28px_80px_rgba(0,71,255,0.14)] flex items-center justify-center">
            <svg
              className="w-[172px] h-[172px] text-[#0047FF] receive-success-icon"
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M32 53V33c0-15.5 12.5-28 28-28s28 12.5 28 28v9"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <path
                d="M26 49h68c6.1 0 11 4.9 11 11v42c0 6.1-4.9 11-11 11H26c-6.1 0-11-4.9-11-11V60c0-6.1 4.9-11 11-11Z"
                fill="currentColor"
              />
              <path
                d="M60 70v20"
                stroke="white"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx="60" cy="69" r="7" fill="white" />
            </svg>
          </div>
        </div>

        <p className="text-[34px] font-black text-[#0047FF] mb-5 word-keep">
          인증이 완료되었습니다
        </p>
        <h1 className="text-[72px] font-black text-[#111827] leading-tight mb-8 word-keep">
          보관함이 열렸습니다
        </h1>
        <p className="text-[34px] font-bold text-[#4B5563] leading-snug word-keep">
          물품을 꺼내주세요
        </p>

        <div className="mt-14 w-full max-w-[460px]">
          <div className="h-4 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div className="h-full rounded-full bg-[#0047FF] receive-success-progress" />
          </div>
          <p className="mt-5 text-[24px] font-bold text-[#6B7280] word-keep">
            {secondsLeft}초 후 처음 화면으로 돌아갑니다
          </p>
        </div>
      </section>
    </main>
  );
}

export default ReceiveSuccess;
