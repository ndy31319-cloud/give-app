import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteCurrentMember } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function SettingsBuyer() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  
  // 알림 설정을 끄고 켜는 상태 
  const [isPushActive, setIsPushActive] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // 회원 탈퇴 처리 함수
  const handleWithdrawal = async () => {
    if (isWithdrawing || !window.confirm('정말 탈퇴하시겠습니까? 계정과 모든 활동 기록이 삭제됩니다.')) {
      return;
    }

    setIsWithdrawing(true);
    try {
      await deleteCurrentMember();
      logout();
      window.alert('탈퇴 처리가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
      navigate('/', { replace: true });
    } catch (error) {
      window.alert(error?.message || '회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="p-8 bg-[#f7f7f4] min-h-screen" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      
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
              ${isPushActive ? 'bg-[#2f7d4f]' : 'bg-gray-200'}`}
          >
            <div className={`w-[24px] h-[24px] bg-white rounded-full absolute top-[4px] transition-all duration-300 
              ${isPushActive ? 'left-[32px]' : 'left-[4px]'}`} 
            />
          </div>
        </div>

        {/* 2. 개인정보 처리방침 */}
        <button 
          onClick={() => setPrivacyOpen(true)}
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
          disabled={isWithdrawing}
          className="w-full text-left p-8 flex justify-between items-center active:bg-gray-50 transition-all disabled:opacity-50"
        >
          <div>
            <h2 className="text-[22px] font-bold text-[#d64545]">회원 탈퇴</h2>
            <p className="text-gray-400 text-[18px]">계정과 모든 활동 기록이 삭제됩니다</p>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {privacyOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
          <div className="w-full max-w-[760px] max-h-[82vh] overflow-y-auto rounded-[28px] bg-white p-8 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 id="privacy-title" className="text-[28px] font-bold text-[#333]">개인정보 처리방침</h2>
              <button type="button" onClick={() => setPrivacyOpen(false)} className="rounded-full px-3 py-2 text-[28px] text-gray-500" aria-label="개인정보 처리방침 닫기">×</button>
            </div>
            <div className="mt-6 space-y-5 text-[18px] leading-relaxed text-gray-600">
              <p>Give는 회원 인증, 나눔 게시글, 채팅, 보관함 이용에 필요한 최소한의 정보만 사용합니다.</p>
              <p><strong className="text-[#333]">수집 정보:</strong> 이름, 닉네임, 연락처, 이메일, 동네 위치, 게시글과 채팅 내용입니다.</p>
              <p><strong className="text-[#333]">이용 목적:</strong> 회원 인증, 나눔 상대 연결, QR 보관함 인증, 알림과 문의 처리입니다.</p>
              <p><strong className="text-[#333]">보관 및 삭제:</strong> 회원 탈퇴 시 서비스 운영에 필요한 법정 보관 정보를 제외한 회원 관련 데이터 삭제를 요청합니다.</p>
              <p>개인정보 관련 문의는 마이페이지의 관리자 문의를 이용해주세요.</p>
            </div>
            <button type="button" onClick={() => setPrivacyOpen(false)} className="mt-8 w-full rounded-[18px] bg-[#2f7d4f] py-4 text-[20px] font-bold text-white">확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsBuyer;
