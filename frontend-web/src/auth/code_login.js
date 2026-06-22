import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithMemberCode } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function CodeLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const postId = searchParams.get('postId');
  const postType = searchParams.get('type') || 'donate';
  const isEasyMode = searchParams.get('easy') === '1';
  const detailPath = postId ? `/posts/${postId}?type=${postType}${isEasyMode ? '&easy=1' : ''}` : '/buyer-main';
  const serialInputRef = useRef(null);
  const [codeYear, setCodeYear] = useState('');
  const [codeSerial, setCodeSerial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const certificateCode = useMemo(
    () => `WF-${codeYear}-${codeSerial}`,
    [codeYear, codeSerial]
  );

  const getDigits = (value) => value.replace(/\D/g, '');

  const handleYearChange = (event) => {
    const digits = getDigits(event.target.value).slice(0, 8);
    const nextYear = digits.slice(0, 4);
    const nextSerial = digits.slice(4, 8);

    setCodeYear(nextYear);

    if (nextSerial) {
      setCodeSerial(nextSerial);
    }

    if (nextYear.length === 4) {
      serialInputRef.current?.focus();
    }
  };

  const handleSerialChange = (event) => {
    setCodeSerial(getDigits(event.target.value).slice(0, 4));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (codeYear.length !== 4 || codeSerial.length !== 4) {
      alert('회원코드를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginWithMemberCode({ code: certificateCode, postId });
      const token = result.accessToken || result.token || result.data?.access_token || result.data?.token;
      const member = result.member || result.user || result.data?.user || result.data || {};
      login('buyer', member.email || member.nickname || 'buyer', token, member);
      navigate('/receive-success', { replace: true });
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-[#F9FAFB] h-screen flex items-center justify-center p-10 overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-[680px] rounded-[40px] shadow-sm p-14 border border-gray-100"
      >
        <button
          type="button"
          onClick={() => navigate(detailPath)}
          className="mb-12 text-[24px] font-bold text-gray-500"
        >
          ← 돌아가기
        </button>

        <div className="text-center mb-14">
          <h1 className="text-[48px] font-bold text-[#333] mb-5">회원코드 인증</h1>
          <p className="text-[24px] text-gray-500 leading-snug">
            물품을 받으려면 회원코드를 입력해주세요
          </p>
        </div>

        <label className="text-[22px] font-bold text-[#333] block mb-4">회원코드</label>
        <div className="mb-10 flex items-center gap-3">
          <div className="h-[82px] px-6 rounded-[22px] bg-[#E9F0FF] text-[#0047FF] flex items-center justify-center text-[30px] font-black shrink-0">
            WF-
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={codeYear}
            onChange={handleYearChange}
            placeholder=""
            maxLength={14}
            className="min-w-0 flex-1 border-2 border-gray-100 rounded-[22px] px-5 py-6 text-[30px] outline-none focus:border-[#0047FF] text-center font-bold"
            autoFocus
            aria-label="회원코드 앞 4자리"
          />
          <span className="text-[34px] font-black text-gray-400">-</span>
          <input
            ref={serialInputRef}
            type="text"
            inputMode="numeric"
            value={codeSerial}
            onChange={handleSerialChange}
            placeholder=""
            maxLength={4}
            className="min-w-0 flex-1 border-2 border-gray-100 rounded-[22px] px-5 py-6 text-[30px] outline-none focus:border-[#0047FF] text-center font-bold"
            aria-label="회원코드 뒤 4자리"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? '인증 중...' : '인증하기'}
        </button>

      </form>
    </div>
  );
}

export default CodeLogin;
