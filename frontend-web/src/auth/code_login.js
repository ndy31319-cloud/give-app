import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthTokenFromLoginResult, loginWithMemberCode } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function CodeLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const firstInputRef = useRef(null);
  const secondInputRef = useRef(null);
  const postId = searchParams.get('postId');
  const postType = searchParams.get('type') || 'donate';
  const isEasyMode = searchParams.get('easy') === '1';
  const mode = searchParams.get('mode');
  const isLockerPickup = mode === 'locker-pickup';
  const isDonationIntent = mode === 'donation-intent';
  const detailPath = isLockerPickup
    ? '/locker'
    : isDonationIntent
      ? (isEasyMode ? '/easy-wanted' : '/wanted')
    : isEasyMode
      ? '/easy-main'
      : '/buyer-main';
  const [codeYear, setCodeYear] = useState('');
  const [codeNumber, setCodeNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getDigits = (value) => value.replace(/\D/g, '');

  const moveCursorToEnd = (input) => {
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    });
  };

  const handleFirstCodeChange = (event) => {
    const digits = getDigits(event.target.value).slice(0, 8);
    const firstPart = digits.slice(0, 4);
    const secondPart = digits.slice(4, 8);

    setCodeYear(firstPart);

    if (secondPart) {
      setCodeNumber(secondPart);
    }

    if (firstPart.length === 4) {
      moveCursorToEnd(secondInputRef.current);
    }
  };

  const handleSecondCodeChange = (event) => {
    setCodeNumber(getDigits(event.target.value).slice(0, 4));
  };

  const handleSecondCodeKeyDown = (event) => {
    if (event.key === 'Backspace' && codeNumber.length === 0) {
      moveCursorToEnd(firstInputRef.current);
    }
  };

  const buildCertificateCode = () => `WF-${codeYear}-${codeNumber}`;

  const getNextPath = () => (
    isLockerPickup
      ? '/locker/pickup'
      : isDonationIntent
        ? (isEasyMode ? '/easy-wanted' : '/wanted')
      : postId
        ? `/appointment-request?postId=${postId}&type=${postType}${isEasyMode ? '&easy=1' : ''}`
        : '/appointment-request'
  );

  const continueWithKioskCertificate = (certificateCode) => {
    const member = {
      email: `kiosk-${certificateCode.toLowerCase()}@local`,
      nickname: certificateCode,
      certificate_no: certificateCode,
      role: 'buyer',
      login_type: 'certificate_code',
    };

    login('buyer', member.email, null, member);
    navigate(getNextPath(), { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const certificateCode = buildCertificateCode();

    if (!/^WF-\d{4}-\d{4}$/.test(certificateCode)) {
      alert('인증번호 숫자 8자리를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginWithMemberCode({ code: certificateCode, postId });
      const token = getAuthTokenFromLoginResult(result);
      const member = result.member || result.user || result.data?.user || result.data || {};

      if (!token && !isLockerPickup) {
        alert('회원코드 인증은 되었지만 로그인 토큰을 받지 못했습니다. 다시 시도해주세요.');
        return;
      }

      login('buyer', member.email || member.nickname || 'buyer', token, member);
      navigate(getNextPath(), { replace: true });
    } catch (error) {
      if (isLockerPickup && /^WF-\d{4}-\d{4}$/.test(certificateCode)) {
        continueWithKioskCertificate(certificateCode);
        return;
      }

      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="code-login-screen bg-[#f7f7f4] h-screen flex items-center justify-center p-10 overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <form
        onSubmit={handleSubmit}
        className="code-login-card bg-white w-full rounded-[40px] shadow-sm p-14 border border-gray-100"
      >
        <button
          type="button"
          onClick={() => navigate(detailPath)}
          className="code-login-back mb-12 text-[24px] font-bold text-gray-500"
        >
          ← 돌아가기
        </button>

        <div className="code-login-title text-center mb-14">
          <h1 className="text-[48px] font-bold text-[#333] mb-5">
            {isLockerPickup ? '물품 찾기' : '회원코드 인증'}
          </h1>
          <p className="text-[24px] text-gray-500 leading-snug">
            {isLockerPickup ? '회원코드를 입력하면 내 물품을 확인할 수 있어요' : '인증번호 숫자 8자리를 입력해주세요'}
          </p>
        </div>

        <label className="code-login-label text-[22px] font-bold text-[#333] block mb-4">회원코드</label>
        <div className="code-login-input-row mb-10 flex items-center gap-5">
          <div className="code-login-prefix h-[82px] px-6 rounded-[22px] bg-[#e9f5ee] text-[#2f7d4f] flex items-center justify-center text-[30px] font-black shrink-0">
            WF
          </div>
          <span className="code-login-separator" aria-hidden="true">-</span>
          <input
            ref={firstInputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={codeYear}
            onChange={handleFirstCodeChange}
            placeholder=""
            maxLength={4}
            className="code-login-input code-login-code-part min-w-0 border-2 border-gray-100 rounded-[22px] px-5 py-6 text-[30px] outline-none focus:border-[#2f7d4f] text-center font-bold"
            autoFocus
            aria-label="회원코드 앞 숫자 4자리"
          />
          <span className="code-login-separator" aria-hidden="true">-</span>
          <input
            ref={secondInputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={codeNumber}
            onChange={handleSecondCodeChange}
            onKeyDown={handleSecondCodeKeyDown}
            placeholder=""
            maxLength={4}
            className="code-login-input code-login-code-part min-w-0 border-2 border-gray-100 rounded-[22px] px-5 py-6 text-[30px] outline-none focus:border-[#2f7d4f] text-center font-bold"
            aria-label="회원코드 뒤 숫자 4자리"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="code-login-submit w-full bg-[#2f7d4f] text-white py-6 rounded-[24px] text-[30px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? '인증 중...' : '인증하기'}
        </button>
      </form>
    </div>
  );
}

export default CodeLogin;
