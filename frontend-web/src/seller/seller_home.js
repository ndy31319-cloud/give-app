import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore'; // 1. Zustand 창고 불러오기!

function SellerHome() {
  const navigate = useNavigate();

  //  2. 창고에서 내 아이디와 로그아웃 함수 꺼내오기
  const userId = useAuthStore((state) => state.userId);
  const logout = useAuthStore((state) => state.logout);

  //  3. 진짜 로그아웃을 처리하는 함수 만들기
  const handleLogout = () => {
    logout(); // 창고에서 로그인 정보 싹 비우기!
    alert('로그아웃 되었습니다.');
    navigate('/'); // 첫 화면으로 쫓아내기
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-[#F8F9FA]" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      
      {/* 상단 환영 메시지 */}
      <div className="text-center mb-20">
        {/*  4. 하드코딩된 '기부자' 대신 userId 사용 */}
        <h1 className="text-[52px] font-bold text-[#333] mb-4">
          반갑습니다, {userId || '기부자'}님!
        </h1>
        <p className="text-[28px] text-gray-400">원하시는 활동을 선택해주세요</p>
      </div>

      {/* 메인 메뉴 버튼 2개 (수정 없음) */}
      <div className="flex gap-12 w-full max-w-[1100px] justify-center">
        
        {/* 1. 물품 등록 버튼 */}
        <button 
          onClick={() => navigate('/seller-input')} 
          className="bg-white w-[500px] py-24 rounded-[48px] shadow-[0px_20px_50px_rgba(0,0,0,0.05)] hover:scale-[1.02] transition-all flex flex-col items-center border-2 border-transparent hover:border-[#22C55E]"
        >
          <div className="w-40 h-40 bg-[#E8F9F1] rounded-full flex items-center justify-center mb-10">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <h2 className="text-[48px] font-bold text-[#333] mb-4">물품 등록</h2>
          <p className="text-[22px] text-gray-400">새로운 나눔 물품을<br />등록합니다</p>
        </button>

        {/* 2. 마이페이지 버튼 */}
        <button 
          onClick={() => navigate('/mypage-seller')} 
          className="bg-white w-[500px] py-24 rounded-[48px] shadow-[0px_20px_50px_rgba(0,0,0,0.05)] hover:scale-[1.02] transition-all flex flex-col items-center border-2 border-transparent hover:border-[#22C55E]"
        >
          <div className="w-40 h-40 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-10">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h2 className="text-[48px] font-bold text-[#333] mb-4">마이페이지</h2>
          <p className="text-[22px] text-gray-400">활동 내역과 등록 물품을<br />관리합니다</p>
        </button>
      </div>

      {/*  5. 단순 이동 대신 진짜 로그아웃 함수(handleLogout) 연결 */}
      <button 
        onClick={handleLogout} 
        className="mt-20 text-gray-400 text-[20px] font-medium border-b border-gray-300 pb-1 hover:text-gray-600 hover:border-gray-600 transition-all"
      >
        로그아웃
      </button>

    </div>
  );
}

export default SellerHome;