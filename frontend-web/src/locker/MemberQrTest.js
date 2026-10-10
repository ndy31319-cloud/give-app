import { Html5Qrcode } from 'html5-qrcode';
import React, { useEffect, useRef, useState } from 'react';
import { validateMemberQr } from '../api/client';

export default function MemberQrTest() {
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const timeoutRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('카메라로 회원 QR을 인식해보세요.');
  const [member, setMember] = useState(null);
  const [errorLog, setErrorLog] = useState([]);

  const showError = (code, text) => {
    setMessage(text);
    setErrorLog((previous) => [{ code, text, time: new Date().toLocaleTimeString('ko-KR') },
      ...previous].slice(0, 5));
  };

  const stop = async () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    if (scanner.isScanning) await scanner.stop();
    await scanner.clear();
  };

  useEffect(() => () => {
    clearTimeout(timeoutRef.current);
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
  }, []);

  const start = async () => {
    if (scanning) return;
    setMember(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showError('CAMERA_UNAVAILABLE', '카메라를 사용할 수 없습니다. HTTPS 또는 이 기기의 localhost 주소로 접속했는지 확인해주세요.');
      return;
    }
    try {
      const scanner = new Html5Qrcode('member-qr-reader');
      scannerRef.current = scanner;
      setScanning(true);
      setMessage('QR을 카메라에 비춰주세요.');
      await scanner.start(
        { facingMode: 'user' },
        { fps: 10, qrbox: { width: 360, height: 360 }, aspectRatio: 1 },
        async (decodedText) => {
          if (busyRef.current) return;
          busyRef.current = true;
          try {
            await stop();
            const result = await validateMemberQr(decodedText);
            setMember(result.data);
            setMessage('회원 QR 인식과 서버 확인에 성공했습니다.');
          } catch (error) {
            showError(error.errorCode || 'QR_VERIFY_FAILED', error.message || '회원 QR 확인에 실패했습니다.');
          } finally {
            busyRef.current = false;
          }
        },
        () => {},
      );
      if (scannerRef.current === scanner && scanner.isScanning) {
        timeoutRef.current = setTimeout(() => {
          void stop().catch(() => {});
          showError('QR_NOT_DETECTED', 'QR을 인식하지 못했습니다. 밝은 곳에서 QR 전체가 보이도록 다시 비춰주세요.');
        }, 20000);
      }
    } catch (error) {
      await stop().catch(() => {});
      const code = error.name === 'NotAllowedError' ? 'CAMERA_DENIED'
        : error.name === 'NotFoundError' ? 'CAMERA_NOT_FOUND' : 'CAMERA_START_FAILED';
      const text = code === 'CAMERA_DENIED' ? '카메라 사용 권한을 허용해주세요.'
        : code === 'CAMERA_NOT_FOUND' ? '연결된 카메라를 찾지 못했습니다.'
          : error.message || '카메라를 시작하지 못했습니다.';
      showError(code, text);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] p-8 text-[#191f1b]">
      <section className="mx-auto max-w-[700px] rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="mb-3 text-3xl font-bold">회원 QR 인식 테스트</h1>
        <p className="mb-6 text-lg">이 화면은 회원 QR을 읽고 서버에 등록된 회원인지 확인합니다. 보관함은 열지 않습니다.</p>
        <div id="member-qr-reader" className="mx-auto max-w-[480px]" />
        <button type="button" onClick={start} disabled={scanning}
          className="mt-6 rounded-xl bg-[#2f7d4f] px-8 py-4 text-xl font-bold text-white disabled:opacity-50">
          {scanning ? 'QR 인식 중' : '카메라로 QR 인식'}
        </button>
        <p role="status" className="mt-6 text-xl">{message}</p>
        {errorLog.length > 0 ? <div className="mt-6 rounded-xl bg-gray-100 p-4 text-left">
          <h2 className="font-bold">최근 오류</h2>
          <ul className="mt-2 space-y-1 text-base">
            {errorLog.map((entry, index) => <li key={`${entry.time}-${index}`}>
              {entry.time} · {entry.code} · {entry.text}
            </li>)}
          </ul>
        </div> : null}
        {member ? <p className="mt-4 text-xl font-bold">
          회원 {member.memberId} · {member.nickname} · {member.roleId === 1 ? '기부자' : '수혜자'}
        </p> : null}
      </section>
    </main>
  );
}
