import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWantedPost, KIOSK_DEFAULT_LOCATION } from '../api/client';
import { getWantedCategoryPayload, URGENCY_OPTIONS, WANTED_CATEGORY_OPTIONS } from './wantedOptions';

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
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmitWanted = isVulnerableMember(savedUser);

  const isCustomCategory = category === 'custom';

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmitWanted) {
      alert('요청해요 글쓰기는 취약계층 회원만 이용할 수 있습니다.');
      return;
    }

    if (!category) {
      alert('필요한 물품 카테고리를 선택해주세요.');
      return;
    }

    if (!title.trim()) {
      alert('필요한 물품 이름을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const categoryPayload = getWantedCategoryPayload(category);
      await createWantedPost({
        title: title.trim(),
        content: content.trim(),
        category: categoryPayload.category,
        categoryId: categoryPayload.categoryId,
        urgency,
        dongName: savedUser?.dongName || savedUser?.dong_name || KIOSK_DEFAULT_LOCATION.dongName,
        latitude: savedUser?.latitude || savedUser?.lat || KIOSK_DEFAULT_LOCATION.latitude,
        longitude: savedUser?.longitude || savedUser?.lng || KIOSK_DEFAULT_LOCATION.longitude,
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
      className="wanted-write-screen p-8 flex justify-center bg-[#f7f7f4] min-h-screen"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="wanted-write-card w-full max-w-2xl bg-white shadow-xl p-10 rounded-[40px] border border-gray-100">
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

        <form onSubmit={handleSubmit} className="wanted-write-form space-y-10">
          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">필요한 물품 카테고리</label>
            <div className="wanted-option-grid grid grid-cols-3 gap-4">
              {WANTED_CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    setTitle('');
                  }}
                  className={`px-5 py-5 rounded-2xl text-[22px] font-bold transition-all border-2 ${
                    category === cat.id
                      ? 'border-[#2f7d4f] bg-[#e9f5ee] text-[#2f7d4f]'
                      : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {isCustomCategory ? (
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-4 w-full bg-white border-2 border-gray-100 rounded-[20px] p-[18px] text-[18px] outline-none focus:border-[#2f7d4f] transition-all"
                placeholder="필요한 물품 이름을 직접 입력하세요"
                required
              />
            ) : null}
          </section>

          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">긴급도</label>
            <div className="wanted-urgency-grid grid grid-cols-3 gap-3">
              {URGENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setUrgency(option.value)}
                  className={`px-4 py-4 rounded-2xl font-bold transition-all border-2 ${
                    urgency === option.value
                      ? 'border-[#2f7d4f] bg-[#e9f5ee] text-[#2f7d4f]'
                      : 'border-gray-100 bg-white text-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {!isCustomCategory ? (
            <section>
              <label className="block text-xl font-bold text-gray-800 mb-4">요청 물품명</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full bg-white border-2 border-gray-100 rounded-[20px] p-[18px] text-[18px] outline-none focus:border-[#2f7d4f] transition-all"
                placeholder="필요한 물품 이름을 입력하세요"
                required
              />
            </section>
          ) : null}

          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">상세 내용</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full bg-white border-2 border-gray-100 rounded-[20px] p-[18px] text-[18px] h-40 resize-none outline-none focus:border-[#2f7d4f] transition-all"
              placeholder="필요한 이유나 원하는 상태를 적어주세요"
            />
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#2f7d4f] text-white py-5 rounded-[18px] text-[22px] font-bold transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isSubmitting ? '등록 중...' : '요청 등록'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WriteWanted;
