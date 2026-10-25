import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  completeLockerPickup,
  fetchLockerPickupItems,
  openLockerForPickup,
} from '../api/client';

function getItemsFromResponse(result) {
  const data = result?.data || result || {};
  return data.items || result?.items || [];
}

function getPendingItemsFromResponse(result) {
  const data = result?.data || result || {};
  return data.pendingItems || data.pending_items || result?.pendingItems || result?.pending_items || [];
}

function getLockerNumber(item) {
  return item?.lockerNumber || item?.locker_number || item?.lockerId || item?.locker_id || '1번 보관함';
}

function getRequestedAt(item) {
  return item?.requestedAt || item?.requested_at || item?.createdAt || item?.created_at || '';
}

function getRequestStatus(item) {
  return String(item?.requestStatus || item?.request_status || item?.status || '').toLowerCase();
}

function getPostStatus(item) {
  return String(item?.postStatus || item?.post_status || '').toLowerCase();
}

function isApprovedWaitingStorage(item) {
  return getRequestStatus(item) === 'approved' && getPostStatus(item) !== 'stored';
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

function buildPickupPayload(item) {
  return {
    pickupId: item?.pickupId || item?.pickup_id,
    donateId: item?.donateId || item?.donate_id,
    lockerId: item?.lockerId || item?.locker_id,
  };
}

function LockerPickup() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [phase, setPhase] = useState('list');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadPickupItems() {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const result = await fetchLockerPickupItems();
        const nextItems = getItemsFromResponse(result);
        const nextPendingItems = getPendingItemsFromResponse(result);

        if (!ignore) {
          setItems(Array.isArray(nextItems) ? nextItems : []);
          setPendingItems(Array.isArray(nextPendingItems) ? nextPendingItems : []);
        }
      } catch (error) {
        if (!ignore) {
          setItems([]);
          setPendingItems([]);
          setErrorMessage(error?.message || '수령 가능한 보관함 물품을 불러오지 못했습니다.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPickupItems();

    return () => {
      ignore = true;
    };
  }, []);

  const lockerNumber = getLockerNumber(activeItem);
  const showEmptyState = !isLoading && items.length === 0;
  const showPendingState = showEmptyState && pendingItems.length > 0;
  const hasOnlyStorageWaitingItems =
    showPendingState && pendingItems.every(isApprovedWaitingStorage);
  const pendingTitle = hasOnlyStorageWaitingItems
    ? '보관을 기다리고 있어요'
    : '수락을 기다리고 있어요';
  const pendingDescription = hasOnlyStorageWaitingItems
    ? '기부자가 물품을 보관함에 넣으면 이곳에서 보관함을 열 수 있어요.'
    : '기부자가 앱에서 수락하고 물품을 보관함에 넣으면 이곳에서 보관함을 열 수 있어요.';

  const handleOpenPickup = async (item) => {
    const itemId = item?.pickupId || item?.pickup_id || item?.donateId || item?.donate_id;

    try {
      setBusyItemId(itemId);
      setErrorMessage('');
      const result = await openLockerForPickup(buildPickupPayload(item));
      const openedItem = result?.data?.item || result?.item || item;
      setActiveItem(openedItem);
      setPhase('opened');
    } catch (error) {
      setErrorMessage(error?.message || '보관함을 열지 못했습니다.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleCompletePickup = async () => {
    if (!activeItem) return;

    try {
      setBusyItemId(activeItem.pickupId || activeItem.pickup_id);
      setErrorMessage('');
      const result = await completeLockerPickup(buildPickupPayload(activeItem));
      setActiveItem(result?.data?.item || result?.item || activeItem);
      setPhase('completed');
    } catch (error) {
      setErrorMessage(error?.message || '물품 수령 완료 처리에 실패했습니다.');
    } finally {
      setBusyItemId(null);
    }
  };

  if (phase === 'opened' && activeItem) {
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
          <p className="mx-auto mb-6 max-w-[620px] text-[26px] font-bold leading-snug text-[#66706a] word-keep">
            {lockerNumber}에서 물품을 꺼낸 뒤 문을 닫아주세요.
          </p>
          {errorMessage ? (
            <p className="mb-5 rounded-[18px] bg-[#fff1f1] p-4 text-[22px] font-black text-[#d64545]">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleCompletePickup}
            disabled={busyItemId !== null}
            className="w-full rounded-[24px] bg-[#2f7d4f] py-5 text-[30px] font-black text-white shadow-lg active:scale-[0.98] disabled:bg-[#c9cec4]"
          >
            {busyItemId !== null ? '닫는 중' : '보관함 물품 닫기'}
          </button>
        </section>
      </main>
    );
  }

  if (phase === 'completed') {
    return (
      <main
        className="min-h-screen bg-[#f7f7f4] p-10 flex items-center justify-center"
        style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
      >
        <section className="w-full max-w-[760px] rounded-[36px] bg-white border border-[#e5e7df] p-8 text-center shadow-sm">
          <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-[#DCFCE7] text-[72px] font-black text-[#25673f]">
            ✓
          </div>
          <p className="mb-4 text-[24px] font-black text-[#25673f]">물품 수령 완료</p>
          <h1 className="mb-6 text-[50px] font-black leading-tight text-[#191f1b] word-keep">
            알림을 보냈습니다
          </h1>
          <p className="mx-auto mb-8 max-w-[620px] text-[26px] font-bold leading-snug text-[#66706a] word-keep">
            기부자 휴대폰 알림함으로 “물품 수령이 완료되었습니다.” 알림이 전송됩니다.
          </p>
          <button
            type="button"
            onClick={() => navigate('/locker', { replace: true })}
            className="w-full rounded-[24px] bg-[#2f7d4f] py-5 text-[30px] font-black text-white shadow-lg active:scale-[0.98]"
          >
            물품보관함으로
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="locker-pickup-screen h-screen bg-[#f7f7f4] p-8 flex items-center justify-center"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <section className="locker-pickup-card w-full max-w-[820px] rounded-[28px] bg-white border border-[#e5e7df] p-6 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[#e9f5ee] text-[60px] font-black text-[#2f7d4f]">
          ✓
        </div>
        <p className="mb-3 text-[22px] font-black text-[#2f7d4f]">회원코드 인증 완료</p>
        <h1 className="mb-4 text-[44px] font-black leading-tight text-[#191f1b] word-keep">
          {showPendingState ? pendingTitle : showEmptyState ? '받을 수 있는 물품이 없어요' : '보관함을 선택해주세요'}
        </h1>
        <p className="mx-auto mb-7 max-w-[620px] text-[22px] font-bold leading-snug text-[#66706a] word-keep">
          {showPendingState
            ? pendingDescription
            : showEmptyState
            ? '아직 보관함에 준비된 물품이 없습니다. 앱에서 진행 상태를 확인하거나 잠시 후 다시 시도해주세요.'
            : '물품 받기를 누르면 보관함 문이 열립니다.'}
        </p>

        {errorMessage ? (
          <p className="mb-5 rounded-[18px] bg-[#fff1f1] p-4 text-[22px] font-black text-[#d64545]">
            {errorMessage}
          </p>
        ) : null}

        <div className="locker-pickup-list-panel mb-5 max-h-[calc(100vh-430px)] min-h-0 space-y-4 overflow-y-auto overscroll-contain rounded-[22px] bg-[#f1f3ee] p-6 text-left [touch-action:pan-y]" style={{ WebkitOverflowScrolling: 'touch' }}>
          {isLoading ? (
            <p className="text-[26px] font-black text-[#66706a]">물품을 확인하는 중입니다...</p>
          ) : showPendingState ? (
            <>
              <p className="mb-3 text-[18px] font-black text-[#66706a]">승인 대기</p>
              {pendingItems.map((item) => {
                const itemId = item.pickupId || item.pickup_id || item.donateId || item.donate_id;
                const itemRequestedAt = formatDateTime(getRequestedAt(item));
                const waitingStorage = isApprovedWaitingStorage(item);

                return (
                  <article key={itemId} className="rounded-[18px] bg-white p-5">
                    <h2 className="mb-4 text-[28px] font-black leading-tight text-[#191f1b] word-keep">
                      {item.title || '제목 없는 물품'}
                    </h2>
                    <p className="rounded-[16px] bg-[#fff5df] p-4 text-[22px] font-black leading-snug text-[#9a5b10] word-keep">
                      {waitingStorage
                        ? '수락이 완료되었습니다. 기부자가 물품을 보관함에 넣으면 받을 수 있어요.'
                        : '기부자가 앱에서 “물품 수령 수락”을 누르면 받을 수 있어요.'}
                    </p>
                    {itemRequestedAt ? (
                      <p className="mt-4 text-[20px] font-bold text-[#66706a] word-keep">{itemRequestedAt} 요청</p>
                    ) : null}
                  </article>
                );
              })}
            </>
          ) : showEmptyState ? (
            <>
              <p className="mb-3 text-[18px] font-black text-[#66706a]">안내</p>
              <p className="text-[26px] font-black leading-snug text-[#191f1b] word-keep">
                후원자가 물품을 보관함에 넣으면 이곳에서 보관함 번호와 수령 안내를 확인할 수 있어요.
              </p>
            </>
          ) : (
            items.map((item) => {
              const itemId = item.pickupId || item.pickup_id || item.donateId || item.donate_id;
              const itemRequestedAt = formatDateTime(getRequestedAt(item));
              const itemLockerNumber = getLockerNumber(item);

              return (
                <article key={itemId} className="rounded-[18px] bg-white p-5">
                  <p className="mb-3 text-[18px] font-black text-[#66706a]">받을 물품</p>
                  <h2 className="mb-5 text-[28px] font-black leading-tight text-[#191f1b] word-keep">
                    {item.title || '제목 없는 물품'}
                  </h2>
                  <div className="mb-5 rounded-[16px] bg-[#f7f7f4] p-4">
                    <p className="text-[18px] font-black text-[#66706a]">보관함 번호</p>
                    <p className="mt-2 text-[34px] font-black text-[#2f7d4f] word-keep">
                      {itemLockerNumber}
                    </p>
                  </div>
                  {itemRequestedAt ? (
                    <p className="mb-5 text-[20px] font-bold text-[#66706a] word-keep">{itemRequestedAt} 요청</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleOpenPickup(item)}
                    disabled={busyItemId !== null}
                    className="w-full rounded-[22px] bg-[#2f7d4f] py-5 text-[26px] font-black text-white shadow-lg active:scale-[0.98] disabled:bg-[#c9cec4] disabled:shadow-none"
                  >
                    {busyItemId === itemId ? '여는 중' : '물품 받기'}
                  </button>
                </article>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/locker')}
          className="locker-pickup-return-button w-full rounded-[22px] bg-[#f1f3ee] py-5 text-[26px] font-black text-[#191f1b] active:scale-[0.98]"
        >
          돌아가기
        </button>
      </section>
    </main>
  );
}

export default LockerPickup;
