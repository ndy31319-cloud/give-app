import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithMemberCode } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function SignupBuyer() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!code.trim()) {
      alert('발급받은 인증번호를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginWithMemberCode({ code: code.trim() });
      const token = result.accessToken || result.token || result.data?.access_token || result.data?.token;
      const member = result.member || result.user || result.data?.member || result.data?.user || result.data || {};
      login('buyer', member.email || member.nickname || 'buyer', token, member);
      alert('인증번호 확인이 완료되었습니다.');
      navigate('/buyer-main');
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
      <div className="bg-white w-full max-w-[720px] rounded-[40px] shadow-sm p-14 border border-gray-100">
        <button
          type="button"
          onClick={() => navigate('/buyer-select')}
          className="mb-12 text-[24px] font-bold text-gray-500"
        >
          ← 돌아가기
        </button>

        <form onSubmit={handleSubmit}>
          <div className="text-center mb-12">
            <h1 className="text-[48px] font-bold text-[#333] mb-5">수요자 회원가입</h1>
            <p className="text-[24px] text-gray-500 leading-snug">
              발급받은 인증번호를 입력해주세요
            </p>
          </div>

          <label className="text-[22px] font-bold text-[#333] block mb-4">인증번호</label>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="예: 1111"
            className="w-full border-2 border-gray-100 rounded-[22px] px-6 py-6 text-[30px] outline-none focus:border-[#0047FF] mb-10 text-center font-bold"
            autoFocus
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold mt-6 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading ? '인증 중...' : '가입 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignupBuyer;
