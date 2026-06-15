import React from 'react';

function ReceiveConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[560px] rounded-[32px] bg-white p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] border border-gray-100"
        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        <h2 className="text-[36px] font-bold text-[#222] mb-5">
          물품을 받으시겠습니까?
        </h2>
        <p className="text-[22px] leading-relaxed text-gray-500 mb-9">
          확인을 누르면 회원코드 입력 화면으로 이동합니다.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[22px] bg-gray-100 px-8 py-5 text-[24px] font-bold text-gray-700 active:scale-95"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[22px] bg-[#22C55E] px-8 py-5 text-[24px] font-bold text-white shadow-lg active:scale-95"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceiveConfirmModal;
