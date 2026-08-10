import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyPosts } from '../api/client';

function getPostsFromResponse(result) {
  return result?.data?.posts || result?.posts || result?.content || result || [];
}

function getLockerNumber(item) {
  return item?.lockerNumber || item?.locker_number || item?.lockerNo || item?.locker_no || '';
}

function getRequestedAt(item) {
  return item?.requestedAt || item?.requested_at || item?.createdAt || item?.created_at || '';
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LockerPickup() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadMyPosts() {
      try {
        setIsLoading(true);
        setHasLoadError(false);
        const result = await fetchMyPosts();
        const posts = getPostsFromResponse(result);

        if (!ignore) {
          setItems(Array.isArray(posts) ? posts : []);
        }
      } catch {
        if (!ignore) {
          setItems([]);
          setHasLoadError(true);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadMyPosts();

    return () => {
      ignore = true;
    };
  }, []);

  const item = items[0] || null;
  const lockerNumber = getLockerNumber(item);
  const requestedAt = useMemo(() => formatDateTime(getRequestedAt(item)), [item]);
  const showEmptyState = !isLoading && (!item || hasLoadError);

  if (isReceiving && item) {
    return (
      <main
        className="min-h-screen bg-[#f7f7f4] p-10 flex items-center justify-center"
        style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
      >
        <section className="w-full max-w-[760px] rounded-[36px] bg-white border border-[#e5e7df] p-8 text-center shadow-sm">
          <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-[#DCFCE7] text-[72px] font-black text-[#25673f]">
            ✓
          </div>
          <p className="mb-4 text-[24px] font-black text-[#25673f]">보관함이 열렸습니다</p>
          <h1 className="mb-6 text-[50px] font-black leading-tight text-[#191f1b] word-keep">
            물품을 꺼내주세요
          </h1>
          <p className="mx-auto mb-8 max-w-[620px] text-[26px] font-bold leading-snug text-[#66706a] word-keep">
            {lockerNumber ? `${lockerNumber}에서 물품을 꺼낸 뒤 문을 닫아주세요.` : '물품을 꺼낸 뒤 보관함 문을 닫아주세요.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="w-full rounded-[24px] bg-[#2f7d4f] py-5 text-[30px] font-black text-white shadow-lg active:scale-[0.98]"
          >
            수령 완료
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#f7f7f4] p-8 flex items-center justify-center"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <section className="w-full max-w-[760px] rounded-[28px] bg-white border border-[#e5e7df] p-6 text-center shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/locker')}
          className="mb-6 block text-[18px] font-bold text-gray-500 active:scale-95"
        >
          ← 물품보관함으로
        </button>

        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#e9f5ee] text-[60px] font-black text-[#2f7d4f]">
          ✓
        </div>
        <p className="mb-3 text-[22px] font-black text-[#2f7d4f]">회원코드 인증 완료</p>
        <h1 className="mb-4 text-[44px] font-black leading-tight text-[#191f1b] word-keep">
          {showEmptyState ? '받을 수 있는 물품이 없어요' : '내 물품을 확인했어요'}
        </h1>
        <p className="mx-auto mb-7 max-w-[620px] text-[22px] font-bold leading-snug text-[#66706a] word-keep">
          {showEmptyState
            ? '아직 보관함에 준비된 물품이 없습니다. 앱에서 진행 상태를 확인하거나 잠시 후 다시 시도해주세요.'
            : '아래 보관함에서 물품을 받을 수 있어요.'}
        </p>

        <div className="mb-7 rounded-[22px] bg-[#f1f3ee] p-6 text-left">
          {isLoading ? (
            <p className="text-[26px] font-black text-[#66706a]">물품을 확인하는 중입니다...</p>
          ) : showEmptyState ? (
            <>
              <p className="mb-3 text-[18px] font-black text-[#66706a]">안내</p>
              <p className="text-[26px] font-black leading-snug text-[#191f1b] word-keep">
                후원자가 물품을 보관함에 넣으면 이곳에서 보관함 번호와 수령 안내를 확인할 수 있어요.
              </p>
            </>
          ) : (
            <>
              <p className="mb-3 text-[18px] font-black text-[#66706a]">받을 물품</p>
              <h2 className="mb-5 text-[28px] font-black leading-tight text-[#191f1b] word-keep">
                {item.title || '제목 없는 물품'}
              </h2>

              <div className="rounded-[18px] bg-white p-5">
                <p className="text-[18px] font-black text-[#66706a]">보관함 번호</p>
                <p className="mt-2 text-[34px] font-black text-[#2f7d4f] word-keep">
                  {lockerNumber || '배정 대기'}
                </p>
              </div>

              {requestedAt ? (
                <p className="mt-5 text-[20px] font-bold text-[#66706a] word-keep">{requestedAt} 요청</p>
              ) : null}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => navigate('/locker')}
            className="rounded-[22px] bg-[#f1f3ee] py-5 text-[26px] font-black text-[#191f1b] active:scale-[0.98]"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={() => item && setIsReceiving(true)}
            disabled={!item || !lockerNumber}
            className="rounded-[22px] bg-[#2f7d4f] py-5 text-[26px] font-black text-white shadow-lg active:scale-[0.98] disabled:bg-[#c9cec4] disabled:shadow-none"
          >
            물품 받기
          </button>
        </div>
      </section>
    </main>
  );
}

export default LockerPickup;
