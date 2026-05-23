import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

function MypageBuyer() {
  const navigate = useNavigate();
  const nickname = useAuthStore((state) => state.nickname);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menus = [
    { title: '관심 목록', link: '/wishlist' },
    { title: '나눔 이용 내역', link: '/history' },
    { title: '환경 설정', link: '/settings' },
  ];

  return (
    <div
      className="p-8 bg-[#F8F9FA] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/buyer-main')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[36px] font-bold text-[#333]">마이페이지</h1>
        </div>

        <button onClick={handleLogout} className="bg-[#6C757D] text-white px-6 py-3 rounded-xl text-[18px] font-bold active:scale-95 transition-all shadow-sm">
          로그아웃
        </button>
      </div>

      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-10 flex items-center gap-8">
        <div className="w-32 h-32 bg-[#E9F0FF] rounded-full flex items-center justify-center">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#0047FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[32px] font-bold text-[#333]">{nickname || '회원'}님</span>
            <span className="bg-[#E9F0FF] text-[#0047FF] text-[16px] px-4 py-1 rounded-full font-bold">수요자</span>
          </div>
          <p className="text-[20px] text-gray-400">회원 정보는 실제 API 연결 후 표시됩니다.</p>
        </div>

        <button onClick={() => navigate('/buyer-edit')} className="ml-auto bg-gray-50 text-gray-600 px-6 py-3 rounded-2xl font-bold border border-gray-200 active:scale-95 transition-all">
          정보 수정
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">나눔 온도</span>
          <span className="text-[40px] font-bold text-[#FF4D4D]">-</span>
        </div>
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">받은 나눔</span>
          <span className="text-[40px] font-bold text-[#0047FF]">0건</span>
        </div>
      </div>

      <div className="space-y-4">
        {menus.map((menu) => (
          <button
            key={menu.link}
            onClick={() => navigate(menu.link)}
            className="w-full bg-white p-8 rounded-[28px] border border-gray-100 flex justify-between items-center active:scale-[0.99] transition-all hover:bg-gray-50"
          >
            <span className="text-[24px] font-bold text-[#333]">{menu.title}</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MypageBuyer;
