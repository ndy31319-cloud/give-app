import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithMemberCode, normalizeCertificateCode } from '../api/client';
import useAuthStore from '../store/useAuthStore';

const CERTIFICATE_DISPLAY_PREFIX = 'WF-';

function CodeLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const postId = searchParams.get('postId');
  const postType = searchParams.get('type') || 'donate';
  const isEasyMode = searchParams.get('easy') === '1';
  const detailPath = postId ? `/posts/${postId}?type=${postType}${isEasyMode ? '&easy=1' : ''}` : '/buyer-main';
  const [codeInput, setCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getDigits = (value) => value.replace(/\D/g, '');

  const handleCodeChange = (event) => {
    setCodeInput(getDigits(event.target.value).slice(0, 8));
  };

  const buildCertificateCode = () => normalizeCertificateCode(codeInput);

  const continueWithKioskCertificate = (certificateCode) => {
    const member = {
      email: `kiosk-${certificateCode.toLowerCase()}@local`,
      nickname: certificateCode,
      certificate_no: certificateCode,
      role: 'buyer',
      login_type: 'certificate_code',
    };

    login('buyer', member.email, null, member);
    navigate('/receive-success', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const certificateCode = buildCertificateCode();

    if (!/^WF-\d{4}-\d{4}$/.test(certificateCode)) {
      alert('0016 또는 20260016처럼 회원코드를 입력해주세요.');
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
      if (/^WF-\d{4}-\d{4}$/.test(certificateCode)) {
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
      className="code-login-screen bg-[#F9FAFB] h-screen flex items-center justify-center p-10 overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
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
          <h1 className="text-[48px] font-bold text-[#333] mb-5">회원코드 인증</h1>
          <p className="text-[24px] text-gray-500 leading-snug">
            숫자 4자리만 입력하거나 전체 코드를 입력해주세요
          </p>
        </div>

        <label className="code-login-label text-[22px] font-bold text-[#333] block mb-4">회원코드</label>
        <div className="code-login-input-row mb-10 flex items-center gap-5">
          <div className="code-login-prefix h-[82px] px-6 rounded-[22px] bg-[#E9F0FF] text-[#0047FF] flex items-center justify-center text-[30px] font-black shrink-0">
            {CERTIFICATE_DISPLAY_PREFIX}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={codeInput}
            onChange={handleCodeChange}
            placeholder=""
            maxLength={8}
            className="code-login-input min-w-0 flex-1 border-2 border-gray-100 rounded-[22px] px-5 py-6 text-[30px] outline-none focus:border-[#0047FF] text-center font-bold"
            autoFocus
            aria-label="회원코드 숫자 4자리"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="code-login-submit w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? '인증 중...' : '인증하기'}
        </button>

      </form>
    </div>
  );
}

export default CodeLogin;
