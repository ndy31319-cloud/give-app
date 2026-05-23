import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginMember } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function LoginBuyer() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await loginMember({ email, password });
      login('buyer', email, result.accessToken, result.member);
      navigate('/buyer-main');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-[#F9FAFB] min-h-screen flex items-center justify-center p-6"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="bg-white w-full max-w-[600px] min-h-[760px] rounded-[40px] shadow-sm p-12 flex flex-col">
        <button
          onClick={() => navigate('/')}
          className="mb-12 self-start hover:bg-gray-100 p-2 rounded-full transition-all"
          type="button"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center mb-14">
          <h1 className="text-[42px] font-bold text-[#333] mb-2">필요한 물품 찾기</h1>
          <p className="text-[20px] text-gray-400">이메일과 비밀번호를 입력해주세요</p>
        </div>

        <form onSubmit={handleLogin} className="flex-1 flex flex-col">
          <div className="space-y-8 flex-1">
            <div>
              <label className="text-[18px] font-bold text-[#333] block mb-3 ml-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full border-2 border-gray-100 rounded-[18px] px-5 py-5 text-[20px] outline-none focus:border-[#0047FF]"
              />
            </div>

            <div>
              <label className="text-[18px] font-bold text-[#333] block mb-3 ml-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full border-2 border-gray-100 rounded-[18px] px-5 py-5 text-[20px] outline-none focus:border-[#0047FF]"
              />
            </div>
          </div>

          <div className="mt-14 space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0047FF] text-white py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98] shadow-lg disabled:opacity-60"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/signup-buyer')}
              className="w-full bg-white text-[#0047FF] border-2 border-[#0047FF] py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98]"
            >
              회원가입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginBuyer;
