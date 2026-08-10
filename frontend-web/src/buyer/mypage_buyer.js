import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentMember, fetchMyLikes, fetchMyPosts } from '../api/client';
import useAuthStore from '../store/useAuthStore';

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('givegive_user') || 'null');
  } catch {
    return null;
  }
}

function readItems(payload, key) {
  const data = payload?.data || payload || {};
  return data[key] || payload?.[key] || data.posts || data.likes || [];
}

function MypageBuyer() {
  const navigate = useNavigate();
  const storeUser = useAuthStore((state) => state.user);
  const nickname = useAuthStore((state) => state.nickname);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState(() => storeUser || getSavedUser() || {});
  const [postCount, setPostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const displayName = useMemo(() => {
    return (
      profile.nickname ||
      profile.name ||
      nickname ||
      profile.email ||
      '회원'
    );
  }, [nickname, profile]);

  const region = profile.dongName || profile.dong_name || profile.location?.dongName || '';
  const email = profile.email || '';
  const phone = profile.phone || '';

  useEffect(() => {
    let ignore = false;

    async function loadMypage() {
      try {
        setIsLoading(true);
        const [memberResult, postsResult, likesResult] = await Promise.all([
          fetchCurrentMember().catch(() => null),
          fetchMyPosts().catch(() => null),
          fetchMyLikes().catch(() => null),
        ]);

        if (ignore) {
          return;
        }

        if (memberResult) {
          const member = memberResult.data || memberResult.member || memberResult;
          setProfile(member);
          setUser(member);
        }

        setPostCount(readItems(postsResult, 'posts').length);
        setLikeCount(readItems(likesResult, 'likes').length);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadMypage();

    return () => {
      ignore = true;
    };
  }, [setUser]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const menus = [
    { title: '관심 목록', detail: `${likeCount}개`, link: '/wishlist' },
    { title: '나눔 이용 내역', detail: `${postCount}개`, link: '/history' },
    { title: '환경 설정', detail: '', link: '/settings' },
  ];

  return (
    <div
      className="p-8 bg-[#f7f7f4] min-h-screen"
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

        <button onClick={handleLogout} className="bg-[#66706a] text-white px-6 py-3 rounded-xl text-[18px] font-bold active:scale-95 transition-all shadow-sm">
          로그아웃
        </button>
      </div>

      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-gray-100 mb-10 flex items-center gap-8">
        <div className="w-32 h-32 bg-[#e9f5ee] rounded-full flex items-center justify-center shrink-0">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-[32px] font-bold text-[#333]">{displayName}님</span>
            <span className="bg-[#e9f5ee] text-[#2f7d4f] text-[16px] px-4 py-1 rounded-full font-bold">수요자</span>
          </div>
          <div className="text-[20px] text-gray-500 leading-relaxed">
            {email && <p>이메일: {email}</p>}
            {phone && <p>전화번호: {phone}</p>}
            {region && <p>지역: {region}</p>}
            {!email && !phone && !region && (
              <p>{isLoading ? '회원 정보를 불러오는 중입니다.' : '표시할 회원 정보가 없습니다.'}</p>
            )}
          </div>
        </div>

        <button onClick={() => navigate('/buyer-edit')} className="ml-auto bg-gray-50 text-gray-600 px-6 py-3 rounded-2xl font-bold border border-gray-200 active:scale-95 transition-all shrink-0">
          정보 수정
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10">
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">나의 글</span>
          <span className="text-[40px] font-bold text-[#d64545]">{postCount}개</span>
        </div>
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-2">
          <span className="text-gray-400 text-[20px] font-medium">관심 목록</span>
          <span className="text-[40px] font-bold text-[#2f7d4f]">{likeCount}개</span>
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
            <span className="ml-auto mr-6 text-[20px] font-bold text-gray-400">{menu.detail}</span>
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
