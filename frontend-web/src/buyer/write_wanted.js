import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWantedPost } from '../api/client';

const DEFAULT_KIOSK_LOCATION = {
  dongName: '안양동',
  latitude: 37.3943,
  longitude: 126.9568,
};

const URGENCY_OPTIONS = [
  { value: 'urgent', label: '급해요' },
  { value: 'normal', label: '급하지 않아요' },
  { value: 'slow', label: '천천히 받아도  되요' },
];

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('givegive_user') || 'null');
  } catch {
    return null;
  }
}

function isVulnerableMember(user) {
  const roleText = String(user?.role || user?.roleName || user?.role_name || '').toUpperCase();
  const roleId = Number(user?.roleId || user?.role_id);

  return roleId === 3 || roleText === 'BENEFICIARY' || roleText.includes('VULNERABLE');
}

function WriteWanted() {
  const navigate = useNavigate();
  const savedUser = useMemo(() => getSavedUser(), []);
  const [category, setCategory] = useState('digital');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmitWanted = isVulnerableMember(savedUser);

  const categories = [
    { id: 'blanket', name: '전기장판' },
    { id: 'rice', name: '쌀' },
    { id: 'ramen', name: '라면' },
    { id: 'clothes', name: '겨울옷' },
    { id: 'heater', name: '난방용품' },
    { id: 'medicine', name: '상비약' },
    { id: 'daily', name: '생활용품' },
    { id: 'etc', name: '직접 입력' },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmitWanted) {
      alert('요청해요 글쓰기는 취약계층 회원만 이용할 수 있습니다.');
      return;
    }

    if (!title.trim()) {
      alert('필요한 물품 이름을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createWantedPost({
        title: title.trim(),
        content: content.trim(),
        urgency,
        dongName: savedUser?.dongName || savedUser?.dong_name || DEFAULT_KIOSK_LOCATION.dongName,
        latitude: savedUser?.latitude || savedUser?.lat || DEFAULT_KIOSK_LOCATION.latitude,
        longitude: savedUser?.longitude || savedUser?.lng || DEFAULT_KIOSK_LOCATION.longitude,
      });
      alert('나눔 요청이 등록되었습니다.');
      navigate('/wanted');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="p-8 flex justify-center bg-[#F8F9FA] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="w-full max-w-2xl bg-white shadow-xl p-10 rounded-[40px] border border-gray-100">
        <header className="mb-12 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/wanted')}
            className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-all"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">요청해요 글쓰기</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">필요한 물품 선택</label>
            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    if (cat.id !== 'etc') {
                      setTitle(cat.name);
                    }
                  }}
                  className={`px-5 py-5 rounded-2xl text-[22px] font-bold transition-all border-2 ${
                    category === cat.id
                      ? 'border-[#0047FF] bg-[#E8EEFF] text-[#0047FF]'
                      : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">긴급도</label>
            <div className="grid grid-cols-3 gap-3">
              {URGENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUrgency(option.value)}
                  className={`px-4 py-4 rounded-2xl font-bold transition-all border-2 ${
                    urgency === option.value
                      ? 'border-[#0047FF] bg-[#E8EEFF] text-[#0047FF]'
                      : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">요청 물품명</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full bg-white border-2 border-gray-100 rounded-[20px] p-[18px] text-[18px] outline-none focus:border-[#0047FF] transition-all"
              placeholder="필요한 물품 이름을 입력하세요"
              required
            />
          </section>

          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">상세 내용</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full bg-white border-2 border-gray-100 rounded-[20px] p-[18px] text-[18px] h-40 resize-none outline-none focus:border-[#0047FF] transition-all"
              placeholder="필요한 이유나 원하는 상태를 적어주세요"
            />
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#0047FF] text-white py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting ? '등록 중...' : '요청 등록'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WriteWanted;
