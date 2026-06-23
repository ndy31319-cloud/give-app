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

function EasyWriteWanted() {
  const navigate = useNavigate();
  const savedUser = useMemo(() => getSavedUser(), []);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmitWanted = isVulnerableMember(savedUser);
  const isCustomCategory = selectedCategory === 'custom';

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmitWanted) {
      alert('요청해요 글쓰기는 취약계층 회원만 이용할 수 있습니다.');
      return;
    }

    if (!selectedCategory) {
      alert('필요한 물품 카테고리를 골라주세요.');
      return;
    }

    if (!title.trim()) {
      alert('필요한 물품을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      const categoryPayload = getWantedCategoryPayload(selectedCategory);
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
      navigate('/easy-wanted');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="bg-[#F8F9FA] h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <header className="bg-[#0047FF] text-white px-12 py-7 flex items-center justify-between shadow-md shrink-0">
        <h1 className="text-[56px] font-bold">요청해요 글쓰기</h1>
        <button
          type="button"
          onClick={() => navigate('/easy-wanted')}
          className="bg-white text-[#0047FF] px-10 py-5 rounded-[28px] text-[34px] font-bold border-4 border-white active:bg-gray-200"
        >
          나가기
        </button>
      </header>

      <form onSubmit={handleSubmit} className="easy-write-scroll flex-1 overflow-y-auto p-8 flex flex-col gap-7">
        <section className="bg-white rounded-[34px] border-4 border-gray-100 p-7 shadow-sm">
          <h2 className="text-[38px] font-bold text-gray-900 mb-6">필요한 물품 카테고리를 골라주세요</h2>
          <div className="grid grid-cols-3 xl:grid-cols-5 gap-4">
            {WANTED_CATEGORY_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(item.id);
                  if (item.id !== 'custom') {
                    setTitle(item.name);
                  } else {
                    setTitle('');
                  }
                }}
                className={`h-[104px] rounded-[26px] text-[28px] font-bold border-4 active:scale-[0.98] ${
                  selectedCategory === item.id
                    ? 'border-[#0047FF] bg-[#E8EEFF] text-[#0047FF]'
                    : 'border-gray-100 bg-white text-gray-500'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
          {isCustomCategory ? (
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-5 w-full border-4 border-gray-100 rounded-[26px] px-7 py-5 text-[34px] font-bold outline-none focus:border-[#0047FF]"
              placeholder="필요한 물품 이름을 직접 입력"
              required
            />
          ) : null}
        </section>

        <section className="bg-white rounded-[34px] border-4 border-gray-100 p-7 shadow-sm">
          <h2 className="text-[34px] font-bold text-gray-900 mb-5">긴급도</h2>
          <div className="grid grid-cols-3 gap-4">
            {URGENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setUrgency(option.value)}
                className={`h-[96px] rounded-[26px] text-[28px] font-bold border-4 active:scale-[0.98] ${
                  urgency === option.value
                    ? 'border-[#0047FF] bg-[#E8EEFF] text-[#0047FF]'
                    : 'border-gray-100 bg-white text-gray-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {!isCustomCategory ? (
          <section className="bg-white rounded-[34px] border-4 border-gray-100 p-7 shadow-sm">
            <label className="block text-[34px] font-bold text-gray-900 mb-5">요청 물품명</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full border-4 border-gray-100 rounded-[26px] px-7 py-5 text-[34px] font-bold outline-none focus:border-[#0047FF]"
              placeholder="필요한 물품 이름"
              required
            />
          </section>
        ) : null}

        <section className="bg-white rounded-[34px] border-4 border-gray-100 p-7 shadow-sm">
          <label className="block text-[34px] font-bold text-gray-900 mb-5">내용</label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="w-full h-[190px] border-4 border-gray-100 rounded-[26px] px-7 py-5 text-[30px] outline-none resize-none focus:border-[#0047FF]"
            placeholder="필요하면 간단히 적어주세요"
          />
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#22C55E] text-white py-6 rounded-[30px] text-[42px] font-bold border-4 border-[#22C55E] shadow-lg active:scale-[0.98] disabled:opacity-60 shrink-0"
        >
          {isSubmitting ? '등록 중...' : '요청 등록하기'}
        </button>
      </form>
    </div>
  );
}

export default EasyWriteWanted;
