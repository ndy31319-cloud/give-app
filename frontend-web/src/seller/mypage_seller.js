import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

function MypageSeller() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      className="bg-[#f7f7f4] min-h-screen p-8"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/seller-home')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[36px] font-bold text-[#333]">마이페이지</h1>
        </div>

        <button onClick={handleLogout} className="bg-[#66706a] text-white px-6 py-3 rounded-xl text-[18px] font-bold active:scale-95 transition-all shadow-sm">
          로그아웃
        </button>
      </div>

      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-10 flex items-center gap-8">
        <div className="w-32 h-32 bg-[#e9f7ef] rounded-full flex items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21c0-4.418-3.582-8-8-8s-8 3.582-8 8" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[32px] font-bold text-[#333]">{userId || '기부자'}님</span>
            <span className="bg-[#e9f7ef] text-[#2f7d4f] text-[16px] px-4 py-1 rounded-full font-bold">기부자</span>
          </div>
          <p className="text-[20px] text-gray-400">회원 정보는 실제 API 연결 후 표시됩니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">나눔 온도</span>
          <span className="text-[40px] font-bold text-[#d64545]">-</span>
        </div>
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">등록한 물품</span>
          <span className="text-[40px] font-bold text-[#2f7d4f]">0건</span>
        </div>
      </div>

      <div className="space-y-4">
        <button onClick={() => navigate('/manage-items')} className="w-full bg-white p-8 rounded-[28px] flex justify-between items-center border border-[#e5e7df] hover:bg-gray-50 active:scale-[0.98]">
          <span className="text-[24px] font-bold text-[#333]">등록 물품 관리</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button onClick={() => navigate('/setting-seller')} className="w-full bg-white p-8 rounded-[28px] flex justify-between items-center border border-[#e5e7df] hover:bg-gray-50 active:scale-[0.98]">
          <span className="text-[24px] font-bold text-[#333]">환경 설정</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default MypageSeller;
