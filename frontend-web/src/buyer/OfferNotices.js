import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchDonationOfferNotices, hasAuthToken } from '../api/client';
import useAuthStore from '../store/useAuthStore';

const NOTICE_SESSION_MS = 2 * 60 * 1000;

function OfferNotices() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const easy = Boolean(location.state?.easy);
  const boardPath = easy ? '/easy-wanted' : '/wanted';
  const roleId = Number(user?.roleId || user?.role_id);
  const verifiedAt = Number(location.state?.verifiedAt);
  const verified = hasAuthToken() && roleId === 3 &&
    Number.isFinite(verifiedAt) && Date.now() - verifiedAt < NOTICE_SESSION_MS;

  useEffect(() => {
    if (!verified) {
      navigate(`/code-login?mode=offer-notices${easy ? '&easy=1' : ''}`, { replace: true });
      return undefined;
    }

    let active = true;
    fetchDonationOfferNotices()
      .then((items) => { if (active) setNotices(items); })
      .catch((cause) => { if (active) setError(cause.message || '알림을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });

    const timeout = window.setTimeout(() => {
      logout();
      navigate(boardPath, { replace: true });
    }, Math.max(0, NOTICE_SESSION_MS - (Date.now() - verifiedAt)));
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [boardPath, easy, logout, navigate, verified, verifiedAt]);

  const leave = () => {
    logout();
    navigate(boardPath, { replace: true });
  };

  if (!verified) return null;

  return (
    <main className="min-h-screen bg-[#f7f7f4] p-10" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center gap-6 mb-10">
          <h1 className="text-[44px] font-bold text-[#333]">내 요청 알림</h1>
          <button type="button" onClick={leave}
            className="bg-white border-2 border-[#2f7d4f] text-[#2f7d4f] rounded-[20px] px-8 py-4 text-[24px] font-bold">
            확인 마치기
          </button>
        </div>
        {loading ? <p className="text-[26px] text-gray-600">알림을 불러오는 중입니다.</p> : null}
        {error ? <p className="text-[26px] text-red-600">{error}</p> : null}
        {!loading && !error && notices.length === 0 ? (
          <div className="bg-white rounded-[28px] p-12 text-[28px] text-gray-600">아직 도착한 나눔 의사가 없어요.</div>
        ) : null}
        <div className="space-y-5">
          {notices.map((notice) => (
            <article key={notice.id} className="bg-white rounded-[28px] p-8 border border-gray-200 shadow-sm">
              <h2 className="text-[26px] font-bold text-[#2f7d4f] mb-3">나눔 의사가 도착했어요</h2>
              <p className="text-[24px] text-[#333] leading-relaxed">{notice.message}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default OfferNotices;
