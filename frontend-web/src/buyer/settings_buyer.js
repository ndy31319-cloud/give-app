import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SettingsBuyer() {
  const navigate = useNavigate();
  
  // 알림 설정을 끄고 켜는 상태 
  const [isPushActive, setIsPushActive] = useState(true);

  // 회원 탈퇴 처리 함수
  const handleWithdrawal = () => {
    if (window.confirm('정말 탈퇴하시겠습니까? 계정과 모든 활동 기록이 삭제됩니다.')) {
      alert('탈퇴 처리가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
      navigate('/'); // 홈 화면으로 이동
    }
  };

  return (
    <div className="p-8 bg-[#F8F9FA] min-h-screen" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      
      {/* 상단 헤더 */}
      <div className="flex items-center gap-4 mb-10">
        <button 
          onClick={() => navigate('/mypage-buyer')} 
          className="hover:bg-gray-100 p-2 rounded-full transition-all"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 className="text-[36px] font-bold text-[#333]">환경 설정</h1>
      </div>

      {/* 설정 카드 리스트 */}
      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
        
        {/* 1. 푸시 알림 설정 (토글) */}
        <div className="p-8 border-b border-gray-50 flex justify-between items-center transition-all">
          <div>
            <h2 className="text-[22px] font-bold text-[#333]">푸시 알림 설정</h2>
            <p className="text-gray-400 text-[18px]">나눔 승인 및 메시지 알림을 받습니다</p>
          </div>
          
          {/* 리액트 토글 스위치 */}
          <div 
            onClick={() => setIsPushActive(!isPushActive)}
            className={`w-[60px] h-[32px] rounded-full relative cursor-pointer transition-all duration-300 
              ${isPushActive ? 'bg-[#0047FF]' : 'bg-gray-200'}`}
          >
            <div className={`w-[24px] h-[24px] bg-white rounded-full absolute top-[4px] transition-all duration-300 
              ${isPushActive ? 'left-[32px]' : 'left-[4px]'}`} 
            />
          </div>
        </div>

        {/* 2. 개인정보 처리방침 */}
        <button 
          onClick={() => alert('개인정보 처리방침 페이지 준비 중입니다.')}
          className="w-full text-left p-8 border-b border-gray-50 flex justify-between items-center active:bg-gray-50 transition-all"
        >
          <div>
            <h2 className="text-[22px] font-bold text-[#333]">개인정보 처리방침</h2>
            <p className="text-gray-400 text-[18px]">데이터 수집 및 이용 안내</p>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* 3. 회원 탈퇴 */}
        <button 
          onClick={handleWithdrawal}
          className="w-full text-left p-8 flex justify-between items-center active:bg-gray-50 transition-all"
        >
          <div>
            <h2 className="text-[22px] font-bold text-[#FF4D4D]">회원 탈퇴</h2>
            <p className="text-gray-400 text-[18px]">계정과 모든 활동 기록이 삭제됩니다</p>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default SettingsBuyer;