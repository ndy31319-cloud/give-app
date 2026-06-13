import { Html5Qrcode } from 'html5-qrcode';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const scannerRef = useRef(null);
  const scanningRef = useRef(false);
  const [scanning, setScanning] = useState(false);
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
  const showDeviceStatus = Boolean(status.token) && status.step !== 'error';

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scanningRef.current = false;
    setScanning(false);

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn('QR scanner stop failed:', error);
    }

    try {
      await scanner.clear();
    } catch (error) {
      console.warn('QR scanner clear failed:', error);
    }

    scannerRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleValidate = async (rawToken) => {
    const token = String(rawToken || '').trim();

    if (!token) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: 'QR을 다시 인식해주세요.',
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

  const handleStartScan = async () => {
    if (working || scanning) return;

    if (!window.isSecureContext) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: '카메라 인식은 HTTPS 주소에서만 사용할 수 있습니다.',
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: '이 브라우저에서는 카메라를 사용할 수 없습니다.',
      });
      return;
    }

    setStatus({
      ...initialStatus,
      message: '카메라가 켜졌습니다. 앱에서 발급된 보관함 QR을 비춰주세요.',
    });

    try {
      const scanner = new Html5Qrcode('locker-qr-reader');
      scannerRef.current = scanner;
      scanningRef.current = true;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 360, height: 360 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          if (!scanningRef.current) return;
          await stopScanner();
          await handleValidate(decodedText);
        },
        () => {}
      );
    } catch (error) {
      await stopScanner();
      setStatus({
        ...initialStatus,
        step: 'error',
        message: error?.message || '카메라를 시작하지 못했습니다. 카메라 권한을 확인해주세요.',
      });
    }
  };

  const handleSkipScanForTest = async () => {
    await stopScanner();
    setStatus({
      step: 'awaiting_item',
      token: 'test-locker-qr',
      lockerOpen: true,
      itemDetected: false,
      message: '테스트 모드입니다. QR 인식 후 물품 대기 화면으로 이동했습니다.',
      session: { displayCode: '테스트 QR' },
      donation: { title: '테스트 보관함 QR' },
      donor: null,
    });
  };

  const handleItemDetected = async () => {
    if (!canDetectItem) return;

    if (status.token === 'test-locker-qr') {
      setStatus((prev) => ({
        ...prev,
        step: 'completed',
        lockerOpen: false,
        itemDetected: true,
        message: '테스트 모드입니다. 물품 감지와 완료 화면까지 확인했습니다.',
      }));
      return;
    }

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
    stopScanner();
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
        {!showDeviceStatus ? (
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

          <div className="rounded-[32px] border-2 border-[#E2E8DE] bg-[#F5F8F3] p-6">
            <div
              id="locker-qr-reader"
              className="w-full min-h-[420px] rounded-[26px] overflow-hidden bg-[#17211B] flex items-center justify-center text-white text-[30px] font-black"
            >
              {scanning ? null : 'QR 스캔 대기'}
            </div>
          </div>

          <div className="rounded-[26px] bg-[#F3F6F1] px-8 py-7 flex gap-5 items-start mt-8">
            <span className="w-12 h-12 rounded-full bg-[#2E8B57] text-white flex items-center justify-center text-[30px] font-black">i</span>
            <p className="text-[30px] leading-snug">{status.message}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-8">
            <button
              type="button"
              onClick={handleStartScan}
              disabled={working || scanning}
              className="h-[104px] rounded-[28px] bg-[#2E8B57] text-white text-[34px] font-black shadow-[0_12px_30px_rgba(46,139,87,0.24)] disabled:bg-[#9BC5AE] disabled:opacity-60 active:scale-[0.98]"
            >
              {working ? '인증 중' : scanning ? '스캔 중' : 'QR 스캔 시작'}
            </button>
            <button
              type="button"
              onClick={handleSkipScanForTest}
              className="h-[104px] rounded-[28px] bg-[#EEF3EC] text-[#17211B] text-[34px] font-black border border-[#E2E8DE] disabled:opacity-50 active:scale-[0.98]"
            >
              스캔 중지
            </button>
          </div>
        </section>
        ) : null}

        {showDeviceStatus ? (
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

          <button
            type="button"
            onClick={handleItemDetected}
            disabled={!canDetectItem || working}
            className="w-full h-[112px] rounded-[28px] bg-[#2E8B57] text-white text-[36px] font-black shadow-[0_12px_30px_rgba(46,139,87,0.24)] disabled:bg-[#9BC5AE] disabled:opacity-60 active:scale-[0.98] mb-8"
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
        ) : null}
      </main>
    </div>
  );
}

export default LockerScreen;
