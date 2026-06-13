import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeLockerQr, validateLockerQr } from '../api/client';

const initialStatus = {
  step: 'idle',
  token: '',
  lockerOpen: false,
  itemDetected: false,
  message: '디바이스가 대기 중입니다.',
  session: null,
  donation: null,
  donor: null,
};

const stepItems = [
  { id: 'qr_scanned', label: 'QR 인식' },
  { id: 'server_validating', label: '서버 검증' },
  { id: 'locker_open', label: '잠금 해제' },
  { id: 'awaiting_item', label: '물품 대기' },
  { id: 'item_detected', label: '물품 감지' },
  { id: 'server_updating', label: '데이터 반영' },
  { id: 'completed', label: '완료' },
];

function stepIndex(step) {
  return stepItems.findIndex((item) => item.id === step);
}

function statusLabel(step) {
  if (step === 'completed') return '완료';
  if (step === 'error') return '오류';
  if (step === 'idle') return '대기';
  return '진행 중';
}

function LockerScreen() {
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState('');
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState(initialStatus);

  const activeIndex = stepIndex(status.step);
  const canDetectItem = status.step === 'awaiting_item' && status.token;
  const statusTone = status.step === 'completed'
    ? 'text-[#15803D]'
    : status.step === 'error'
      ? 'text-[#DC2626]'
      : 'text-[#2E8B57]';

  const donationTitle = useMemo(() => {
    return status.donation?.title || status.session?.displayCode || '보관함 입고 QR';
  }, [status.donation, status.session]);

  const handleValidate = async () => {
    const token = tokenInput.trim();

    if (!token) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: 'QR 토큰을 입력해주세요.',
      });
      return;
    }

    setWorking(true);
    setStatus({
      ...initialStatus,
      step: 'qr_scanned',
      token,
      message: 'QR을 인식했습니다. 서버 검증을 시작합니다.',
    });

    try {
      setStatus((prev) => ({
        ...prev,
        step: 'server_validating',
        message: 'QR 토큰과 나눔 게시글 정보를 확인하고 있습니다.',
      }));

      const result = await validateLockerQr(token);
      const data = result.data || result;
      const session = data.qrSession || data.qr_session || data;

      setStatus({
        step: 'locker_open',
        token,
        lockerOpen: true,
        itemDetected: false,
        message: '인증이 완료되어 보관함 잠금이 해제되었습니다.',
        session,
        donation: data.donation || null,
        donor: data.donor || null,
      });

      window.setTimeout(() => {
        setStatus((prev) => {
          if (prev.step !== 'locker_open') return prev;
          return {
            ...prev,
            step: 'awaiting_item',
            message: '물품을 보관함에 넣은 뒤 물품 투입 감지를 눌러주세요.',
          };
        });
      }, 700);
    } catch (error) {
      setStatus({
        ...initialStatus,
        step: 'error',
        token,
        message: error.message || '보관함 QR 인증에 실패했습니다.',
      });
    } finally {
      setWorking(false);
    }
  };

  const handleItemDetected = async () => {
    if (!canDetectItem) return;

    setWorking(true);
    setStatus((prev) => ({
      ...prev,
      step: 'item_detected',
      itemDetected: true,
      message: '물품 투입을 감지했습니다. 완료 처리를 시작합니다.',
    }));

    try {
      setStatus((prev) => ({
        ...prev,
        step: 'server_updating',
        message: 'QR 사용 처리와 게시글 보관 완료 상태를 반영하고 있습니다.',
      }));

      const result = await consumeLockerQr(status.token);
      const data = result.data || result;
      const session = data.qrSession || data.qr_session || status.session;

      setStatus((prev) => ({
        ...prev,
        step: 'completed',
        lockerOpen: false,
        itemDetected: true,
        session,
        donation: data.donation || prev.donation,
        donor: data.donor || prev.donor,
        message: '물품보관함 입고 처리가 완료되었습니다.',
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        step: 'error',
        message: error.message || '완료 처리 중 문제가 발생했습니다.',
      }));
    } finally {
      setWorking(false);
    }
  };

  const handleReset = () => {
    setTokenInput('');
    setStatus(initialStatus);
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAF7] text-[#17211B] overflow-y-auto"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E2E8DE] px-16 py-8 flex items-center gap-8 z-10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-24 h-24 rounded-full bg-[#EEF3EC] flex items-center justify-center text-[54px] font-bold active:scale-95"
          aria-label="뒤로가기"
        >
          ‹
        </button>
        <div>
          <h1 className="text-[56px] font-black leading-tight">물품보관함</h1>
          <p className="text-[26px] text-[#69756D] mt-2">앱에서 발급한 나눔 게시글 보관 QR을 인증합니다</p>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-10 py-12 space-y-10">
        <section className="bg-white border border-[#E2E8DE] rounded-[36px] p-10 shadow-sm">
          <div className="flex items-start justify-between gap-8 mb-8">
            <div>
              <p className="text-[22px] font-bold text-[#2E8B57] mb-3">1회용 동적 QR</p>
              <h2 className="text-[40px] font-black leading-tight">{donationTitle}</h2>
              {status.donor ? (
                <p className="text-[24px] text-[#69756D] mt-3">
                  기부자 {status.donor.nickname || status.donor.name || '회원'}
                </p>
              ) : null}
            </div>
            <div className={`text-[30px] font-black ${statusTone}`}>{statusLabel(status.step)}</div>
          </div>

          <label className="block text-[24px] font-black mb-4" htmlFor="locker-token">
            QR 토큰
          </label>
          <textarea
            id="locker-token"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="앱에서 발급한 time-based QR 토큰을 입력하세요"
            className="w-full min-h-[150px] rounded-[26px] border-2 border-[#E2E8DE] bg-[#F5F8F3] px-8 py-6 text-[26px] outline-none focus:border-[#2E8B57] resize-none"
          />

          <div className="grid grid-cols-2 gap-6 mt-8">
            <button
              type="button"
              onClick={handleValidate}
              disabled={working || !tokenInput.trim()}
              className="h-[104px] rounded-[28px] bg-[#9BC5AE] text-white text-[34px] font-black disabled:opacity-50 active:scale-[0.98]"
            >
              {working && status.step !== 'awaiting_item' ? '인증 중' : 'QR 인증'}
            </button>
            <button
              type="button"
              onClick={() => setTokenInput(status.token || tokenInput)}
              className="h-[104px] rounded-[28px] bg-[#EEF3EC] text-[#17211B] text-[34px] font-black border border-[#E2E8DE] active:scale-[0.98]"
            >
              현재 QR 채우기
            </button>
          </div>
        </section>

        <section className="bg-white border border-[#E2E8DE] rounded-[36px] p-10 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[40px] font-black">디바이스 진행 상태</h2>
            <span className={`text-[30px] font-black ${statusTone}`}>{statusLabel(status.step)}</span>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-10">
            {stepItems.map((item, index) => {
              const active = status.step === item.id;
              const done = activeIndex >= index && status.step !== 'error';
              return (
                <div
                  key={item.id}
                  className={`rounded-[24px] border-2 px-7 py-6 flex items-center gap-5 ${
                    active || done ? 'border-[#9BC5AE] bg-[#F3FAF5]' : 'border-[#E2E8DE] bg-white'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full ${active || done ? 'bg-[#2E8B57]' : 'bg-[#CFD8CF]'}`} />
                  <span className={`text-[28px] font-black ${active || done ? 'text-[#2E8B57]' : 'text-[#6B756E]'}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="rounded-[26px] bg-[#F3F6F1] px-8 py-7 flex gap-5 items-start mb-8">
            <span className="w-12 h-12 rounded-full bg-[#2E8B57] text-white flex items-center justify-center text-[30px] font-black">i</span>
            <p className="text-[30px] leading-snug">{status.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="h-[94px] rounded-[26px] bg-[#F3F6F1] flex items-center justify-center text-[30px] font-black text-[#17211B]">
              {status.lockerOpen ? '잠금 해제' : '잠금 유지'}
            </div>
            <div className="h-[94px] rounded-[26px] bg-[#F3F6F1] flex items-center justify-center text-[30px] font-black text-[#17211B]">
              {status.itemDetected ? '감지 완료' : '감지 대기'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleItemDetected}
            disabled={!canDetectItem || working}
            className="w-full h-[112px] rounded-[28px] bg-[#9BC5AE] text-white text-[36px] font-black disabled:opacity-50 active:scale-[0.98] mb-8"
          >
            물품 투입 감지
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full h-[112px] rounded-[28px] bg-white border-2 border-[#E2E8DE] text-[#17211B] text-[36px] font-black active:scale-[0.98]"
          >
            시뮬레이터 초기화
          </button>
        </section>
      </main>
    </div>
  );
}

export default LockerScreen;
