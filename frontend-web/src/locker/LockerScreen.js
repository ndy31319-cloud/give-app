import { Html5Qrcode } from 'html5-qrcode';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeLockerQr, validateLockerQr } from '../api/client';
import {
  formatLockerManualCode,
  getLockerQrErrorMessage,
  inspectLockerQrPayload,
  maskLockerQrToken,
} from './lockerQr';

const initialStatus = {
  step: 'idle',
  token: '',
  lockerOpen: false,
  itemDetected: false,
  message: '디바이스가 대기 중입니다.',
  session: null,
  donation: null,
  donor: null,
  scannedTokenLabel: '',
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

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    if (error.code === 'QR_NOT_FOUND') {
      return `QR 검증 실패: ${error.message}`;
    }
    if (error.code === 'QR_EXPIRED' || error.code === 'QR_ALREADY_USED') {
      return `QR 상태 오류: ${error.message}`;
    }
    if (error.code === 'QR_WRONG_PURPOSE') {
      return `QR 종류 오류: ${error.message}`;
    }
    if (error.code === 'KIOSK_AUTH_FAILED') {
      return `키오스크 설정 오류: ${error.message}`;
    }
    if (error.code === 'QR_DB_ERROR' || error.code === 'DONATION_LOOKUP_FAILED') {
      return `서버/DB 오류: ${error.message}`;
    }
    if (error.code === 'DONATION_NOT_FOUND') {
      return `게시글 연결 오류: ${error.message}`;
    }
    if (error.code === 'QR_CONSUME_FAILED') {
      return `입고 처리 오류: ${error.message}`;
    }
    if (error.code === 'INVALID_JSON_RESPONSE') {
      return `API 주소 오류: ${error.message}`;
    }
    if (error.code === 'HTTP_404') {
      return `API 경로 오류: ${error.message}`;
    }
    if (/^HTTP_5\d\d$/.test(error.code || '')) {
      return `백엔드 서버 오류: ${error.message}`;
    }
    if (error.code === 'TIMEOUT') {
      return `응답 시간 초과: ${error.message}`;
    }
    if (error.code === 'NETWORK') {
      return `네트워크 연결 실패: ${error.message}`;
    }
    if (error.name === 'TypeError' && /fetch|network|failed to fetch/i.test(error.message)) {
      return '네트워크 오류: Render 백엔드에 연결할 수 없습니다. 인터넷 연결과 API 주소를 확인해 주세요.';
    }
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

function statusLabel(step) {
  if (step === 'completed') return '완료';
  if (step === 'error') return '오류';
  if (step === 'idle') return '대기';
  return '진행 중';
}

function isLockerCode(value) {
  return /^WF-\d{4}-[A-Z0-9]{4}$/.test(value);
}

function getLockerCodeExample() {
  return `WF-${new Date().getFullYear()}-A7K9`;
}

function getCameraErrorMessage(error) {
  const name = error?.name || '';
  const message = error?.message || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '카메라 권한이 거부되었습니다. iPad 설정 또는 Safari 주소창의 권한 설정에서 카메라를 허용해 주세요.';
  }

  if (name === 'NotFoundError' || /Requested device not found/i.test(message)) {
    return '사용 가능한 카메라를 찾지 못했습니다. 다른 브라우저 탭에서 카메라를 사용 중인지 확인해 주세요.';
  }

  if (name === 'NotReadableError' || /Could not start video source/i.test(message)) {
    return '카메라를 시작하지 못했습니다. 다른 앱에서 카메라를 사용 중이면 종료한 뒤 다시 시도해 주세요.';
  }

  if (name === 'OverconstrainedError' || /constraint/i.test(message)) {
    return '후면 카메라 조건으로 시작하지 못했습니다. 다른 카메라 방식으로 다시 시도해 주세요.';
  }

  return message || '카메라 권한을 확인하거나 HTTPS 주소에서 다시 시도해 주세요.';
}

function LockerScreen() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const scanningRef = useRef(false);
  const scanHintTimerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [working, setWorking] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState(initialStatus);

  const activeIndex = stepIndex(status.step);
  const canDetectItem = status.step === 'awaiting_item' && status.token;
  const statusTone = status.step === 'completed'
    ? 'text-[#25673f]'
    : status.step === 'error'
      ? 'text-[#d64545]'
      : 'text-[#2f7d4f]';

  const donationTitle = useMemo(() => {
    return status.donation?.title || status.session?.displayCode || '보관함 입고 QR';
  }, [status.donation, status.session]);
  const showDeviceStatus = Boolean(status.token) && status.step !== 'error';

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scanningRef.current = false;
    if (scanHintTimerRef.current) {
      window.clearTimeout(scanHintTimerRef.current);
      scanHintTimerRef.current = null;
    }
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
      if (scanHintTimerRef.current) {
        window.clearTimeout(scanHintTimerRef.current);
      }
    };
  }, []);

  const startScannerWithFallback = async (scanner) => {
    const config = {
      fps: 15,
      // A fixed 360px box can consume an entire low-resolution front-camera
      // frame on older iPads, leaving too little QR margin to decode reliably.
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const size = Math.max(180, Math.floor(Math.min(viewfinderWidth, viewfinderHeight, 420) * 0.8));
        return { width: size, height: size };
      },
      aspectRatio: 4 / 3,
    };
    const onScanSuccess = (decodedText) => {
      if (!scanningRef.current) return;
      scanningRef.current = false;
      void stopScanner().then(() => handleValidate(decodedText));
    };
    const onScanFailure = () => {};
    let lastError = null;

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      throw error;
    }

    try {
      const cameras = await Html5Qrcode.getCameras();
      const frontCamera =
        cameras.find((camera) => /front|user|facetime|전면/i.test(camera.label || '')) ||
        cameras[0];

      if (frontCamera?.id) {
        try {
          await scanner.start(
            { deviceId: { exact: frontCamera.id } },
            config,
            onScanSuccess,
            onScanFailure,
          );
          return;
        } catch (error) {
          lastError = error;
          console.warn('QR scanner deviceId start failed:', error);
        }
      }
    } catch (error) {
      lastError = error;
      console.warn('QR camera listing failed:', error);
    }

    const fallbackConstraints = [
      {
        facingMode: { exact: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      { facingMode: 'user' },
      { facingMode: 'environment' },
    ];

    for (const constraint of fallbackConstraints) {
      try {
        await scanner.start(constraint, config, onScanSuccess, onScanFailure);
        return;
      } catch (error) {
        lastError = error;
        console.warn('QR scanner fallback start failed:', error);
      }
    }

    throw lastError || new Error('카메라를 시작하지 못했습니다.');
  };

  const handleValidate = async (rawToken) => {
    const inspection = inspectLockerQrPayload(rawToken);
    const token = inspection.token;

    if (!inspection.valid) {
      setStatus({
        ...initialStatus,
        step: 'error',
        scannedTokenLabel: token ? maskLockerQrToken(token) : '',
        message: inspection.message,
      });
      return;
    }

    setWorking(true);
    setStatus({
      ...initialStatus,
      step: 'qr_scanned',
      token,
      scannedTokenLabel: maskLockerQrToken(token),
      message: inspection.message,
    });

    try {
      setStatus((prev) => ({
        ...prev,
        step: 'server_validating',
        message: `인식한 QR 토큰(${prev.scannedTokenLabel})과 나눔 게시글 정보를 확인하고 있습니다.`,
      }));

      const result = await validateLockerQr(token);
      const data = result.data || result;
      const session = data.qrSession || data.qr_session || data;

      setStatus({
        step: 'locker_open',
        token: session.token || token,
        lockerOpen: true,
        itemDetected: false,
        message: '인증이 완료되어 보관함 잠금이 해제되었습니다.',
        session,
        donation: data.donation || null,
        donor: data.donor || null,
        scannedTokenLabel: maskLockerQrToken(token),
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
        scannedTokenLabel: maskLockerQrToken(token),
        message: getErrorMessage(error, getLockerQrErrorMessage(error)),
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
      message: '전면 카메라가 켜졌습니다. 앱에서 발급된 보관함 QR을 비춰주세요.',
    });

    try {
      const scanner = new Html5Qrcode('locker-qr-reader');
      scannerRef.current = scanner;
      scanningRef.current = true;
      setScanning(true);

      await startScannerWithFallback(scanner);
      scanHintTimerRef.current = window.setTimeout(() => {
        if (scanningRef.current) {
          setStatus((prev) => ({
            ...prev,
            message: 'QR 판독 실패: QR이 흐리거나 화면에서 너무 멀 수 있습니다. 밝은 곳에서 QR 전체를 카메라 안에 맞춰 주세요.',
          }));
        }
      }, 5000);
    } catch (error) {
      await stopScanner();
      setStatus({
        ...initialStatus,
        step: 'error',
        message: `카메라 시작 오류: ${getCameraErrorMessage(error)}`,
      });
    }
  };

  const handleStopScan = async () => {
    await stopScanner();
    setStatus({
      ...initialStatus,
      message: '스캔을 중지했습니다. QR 아래 인증번호를 직접 입력할 수 있습니다.',
    });
  };

  const handleManualCodeSubmit = async (event) => {
    event.preventDefault();
    if (!String(manualCode || '').trim()) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: `인증번호를 입력해주세요. 예: ${getLockerCodeExample()}`,
      });
      return;
    }

    const code = formatLockerManualCode(manualCode);
    const inspection = inspectLockerQrPayload(code);

    if (!inspection.valid || (!isLockerCode(code) && !/^(gq_|give\||https?:\/\/|\{)/i.test(code))) {
      setStatus({
        ...initialStatus,
        step: 'error',
        message: `앱 QR 아래의 인증번호를 입력해주세요. 예: ${getLockerCodeExample()}`,
      });
      return;
    }

    await stopScanner();
    setManualCode(code);
    await handleValidate(code);
  };

  const handleItemDetected = async () => {
    if (!canDetectItem) return;

    if (status.token === 'test-locker-qr') {
      window.alert('물품 보관이 완료되었습니다.');
      navigate('/locker', { replace: true });
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
        message: '물품 보관이 완료되었습니다.',
      }));
      window.alert('물품 보관이 완료되었습니다.');
      navigate('/locker', { replace: true });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        step: 'error',
        message: getErrorMessage(error, '완료 처리 중 문제가 발생했습니다.'),
      }));
    } finally {
      setWorking(false);
    }
  };

  const handleReset = () => {
    stopScanner();
    setManualCode('');
    setStatus(initialStatus);
  };

  return (
    <div
      className="min-h-screen bg-[#f7f7f4] text-[#191f1b] overflow-y-auto"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <header className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#e5e7df] px-16 py-8 flex items-center gap-8 z-10">
        <button
          type="button"
          onClick={() => navigate('/locker')}
          className="locker-back-button w-24 h-24 rounded-full bg-[#f1f3ee] flex items-center justify-center active:scale-95"
          aria-label="뒤로가기"
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18L9 12L15 6" />
          </svg>
        </button>
        <div>
          <h1 className="text-[56px] font-black leading-tight">물품보관함</h1>
          <p className="text-[26px] text-[#66706a] mt-2">앱에서 발급한 나눔 게시글 보관 QR을 인증합니다</p>
        </div>
      </header>

      <main className="max-w-[980px] mx-auto px-10 py-12 space-y-10">
        {!showDeviceStatus ? (
        <section className="bg-white border border-[#e5e7df] rounded-[36px] p-10 shadow-sm">
          <div className="flex items-start justify-between gap-8 mb-8">
            <div>
              <p className="text-[22px] font-bold text-[#2f7d4f] mb-3">1회용 동적 QR</p>
              <h2 className="text-[40px] font-black leading-tight">{donationTitle}</h2>
              {status.donor ? (
                <p className="text-[24px] text-[#66706a] mt-3">
                  기부자 {status.donor.nickname || status.donor.name || '회원'}
                </p>
              ) : null}
            </div>
            <div className={`text-[30px] font-black ${statusTone}`}>{statusLabel(status.step)}</div>
          </div>

          <div className="rounded-[32px] border-2 border-[#e5e7df] bg-[#F5F8F3] p-6">
            <div
              id="locker-qr-reader"
              className="w-full min-h-[420px] rounded-[26px] overflow-hidden bg-[#191f1b] flex items-center justify-center text-white text-[30px] font-black"
            >
              {scanning ? null : 'QR 스캔 대기'}
            </div>
          </div>

          <div className="rounded-[26px] bg-[#f1f3ee] px-8 py-7 flex gap-5 items-start mt-8">
            <span className="w-12 h-12 rounded-full bg-[#2f7d4f] text-white flex items-center justify-center text-[30px] font-black">i</span>
            <p className="text-[30px] leading-snug">{status.message}</p>
          </div>

          {status.scannedTokenLabel ? (
            <p className="mt-5 text-[22px] font-bold text-[#526158]">
              인식한 QR 토큰: {status.scannedTokenLabel}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-6 mt-8">
            <button
              type="button"
              onClick={handleStartScan}
              disabled={working || scanning}
              className="h-[104px] rounded-[28px] bg-[#2f7d4f] text-white text-[34px] font-black shadow-[0_12px_30px_rgba(46,139,87,0.24)] disabled:bg-[#c9cec4] disabled:opacity-60 active:scale-[0.98]"
            >
              {working ? '인증 중' : scanning ? '스캔 중' : 'QR 스캔 시작'}
            </button>
            <button
              type="button"
              onClick={handleStopScan}
              className="h-[104px] rounded-[28px] bg-[#f1f3ee] text-[#191f1b] text-[34px] font-black border border-[#e5e7df] disabled:opacity-50 active:scale-[0.98]"
            >
              스캔 중지
            </button>
          </div>

          <form onSubmit={handleManualCodeSubmit} className="mt-8 border-t border-[#e5e7df] pt-8">
            <label htmlFor="locker-manual-code" className="block text-[26px] font-black text-[#191f1b] mb-3">
              QR이 인식되지 않나요?
            </label>
            <p className="text-[22px] text-[#66706a] mb-5">
              앱 QR 아래의 인증번호를 직접 입력하세요. 하이픈 없이 입력해도 자동으로 변환됩니다.
            </p>
            <div className="flex gap-4">
              <input
                id="locker-manual-code"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={manualCode}
                onChange={(event) => setManualCode(formatLockerManualCode(event.target.value))}
                placeholder={getLockerCodeExample()}
                maxLength={96}
                disabled={working}
                className="min-w-0 flex-1 h-[92px] rounded-[24px] border-2 border-[#d8ddd4] bg-white px-6 text-[30px] font-black tracking-[0.04em] outline-none focus:border-[#2f7d4f] disabled:bg-[#f1f3ee]"
                aria-label="보관함 QR 인증번호"
              />
              <button
                type="submit"
                disabled={working}
                className="h-[92px] shrink-0 rounded-[24px] bg-[#191f1b] px-8 text-[28px] font-black text-white disabled:bg-[#c9cec4] disabled:opacity-60"
              >
                인증번호 확인
              </button>
            </div>
          </form>
        </section>
        ) : null}

        {showDeviceStatus ? (
        <section className="bg-white border border-[#e5e7df] rounded-[36px] p-10 shadow-sm">
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
                    active || done ? 'border-[#c9cec4] bg-[#F3FAF5]' : 'border-[#e5e7df] bg-white'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full ${active || done ? 'bg-[#2f7d4f]' : 'bg-[#c9cec4]'}`} />
                  <span className={`text-[28px] font-black ${active || done ? 'text-[#2f7d4f]' : 'text-[#66706a]'}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="rounded-[26px] bg-[#f1f3ee] px-8 py-7 flex gap-5 items-start mb-8">
            <span className="w-12 h-12 rounded-full bg-[#2f7d4f] text-white flex items-center justify-center text-[30px] font-black">i</span>
            <p className="text-[30px] leading-snug">{status.message}</p>
          </div>

          {status.scannedTokenLabel ? (
            <p className="-mt-3 mb-8 text-[22px] font-bold text-[#526158]">
              인식한 QR 토큰: {status.scannedTokenLabel}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleItemDetected}
            disabled={!canDetectItem || working}
            className="w-full h-[112px] rounded-[28px] bg-[#2f7d4f] text-white text-[36px] font-black shadow-[0_12px_30px_rgba(46,139,87,0.24)] disabled:bg-[#c9cec4] disabled:opacity-60 active:scale-[0.98] mb-8"
          >
            물품 투입 감지
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full h-[112px] rounded-[28px] bg-white border-2 border-[#e5e7df] text-[#191f1b] text-[36px] font-black active:scale-[0.98]"
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
