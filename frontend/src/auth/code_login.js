import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginWithMemberCode } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function CodeLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const postId = searchParams.get('postId');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!code.trim()) {
      alert('회원코드를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginWithMemberCode({ code: code.trim(), postId });
      login('buyer', result.member?.email || result.member?.nickname || 'buyer', result.accessToken, result.member);
      alert('회원코드 인증이 완료되었습니다.');
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
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-[680px] rounded-[40px] shadow-sm p-14 border border-gray-100"
      >
        <button
          type="button"
          onClick={() => navigate(postId ? `/posts/${postId}` : '/buyer-main')}
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
          className="w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {isLoading ? '인증 중...' : '인증하기'}
        </button>

      </form>
    </div>
  );
}

export default CodeLogin;
