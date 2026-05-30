import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore'; // 💡 Zustand 창고 불러오기

function LoginSeller() {
  const navigate = useNavigate();
  
  //  창고에서 login 함수 꺼내오기
  const login = useAuthStore((state) => state.login);
  
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (id && password) {
      //  로그인 성공! 창고에 '기부자(seller)' 권한과 '입력한 아이디(id)' 저장
      login('seller', id);
      alert('로그인 되었습니다.');
      navigate('/seller-home'); 
    } else {
      alert('아이디와 비밀번호를 모두 입력해주세요.');
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      <div className="bg-white w-full max-w-[600px] min-h-[800px] rounded-[40px] shadow-sm p-12 flex flex-col">
        
        <button onClick={() => navigate('/')} className="mb-12 self-start hover:bg-gray-100 p-2 rounded-full transition-all">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="text-center mb-16">
          <h1 className="text-[42px] font-bold text-[#333] mb-2">기부자 로그인</h1>
          <p className="text-[20px] text-gray-400">아이디와 비밀번호를 입력해주세요</p>
        </div>

        <form onSubmit={handleLogin} className="flex-1 flex flex-col">
          <div className="space-y-8 flex-1">
            <div>
              <label className="text-[18px] font-bold text-[#333] block mb-3 ml-1">아이디</label>
              <div className="focus-within:border-[#22C55E] flex items-center border-2 border-gray-100 rounded-[18px] px-5 py-4 bg-white transition-all">
                <svg className="mr-3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input 
                  type="text" 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="아이디를 입력하세요" 
                  className="w-full text-[18px] outline-none placeholder:text-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="text-[18px] font-bold text-[#333] block mb-3 ml-1">비밀번호</label>
              <div className="focus-within:border-[#22C55E] flex items-center border-2 border-gray-100 rounded-[18px] px-5 py-4 bg-white transition-all">
                <svg className="mr-3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요" 
                  className="w-full text-[18px] outline-none placeholder:text-gray-300"
                />
              </div>
            </div>
          </div>

          <div className="mt-16 space-y-4">
            <button type="submit" className="w-full bg-[#22C55E] text-white py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98] shadow-lg">
              로그인
            </button> 
            <button type="button" onClick={() => navigate('/signup-seller')} className="w-full bg-white text-[#22C55E] border-2 border-[#22C55E] py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98]">
              회원가입
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default LoginSeller;