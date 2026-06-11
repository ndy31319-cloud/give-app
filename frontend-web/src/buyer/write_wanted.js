import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWantedPost } from '../api/client';

function WriteWanted() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('digital');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: 'digital', name: '디지털/가전' },
    { id: 'fashion', name: '패션/의류' },
    { id: 'furniture', name: '가구/인테리어' },
    { id: 'book', name: '도서/교육' },
    { id: 'etc', name: '기타' },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      alert('필요한 물품 이름을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createWantedPost({
        title: title.trim(),
        content: content.trim(),
        category,
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
      className="easy-write-scroll h-screen overflow-y-auto p-8 flex justify-center bg-[#F8F9FA]"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <div className="w-full max-w-2xl h-fit mb-8 bg-white shadow-xl p-10 rounded-[40px] border border-gray-100">
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
          <h1 className="text-3xl font-bold text-gray-900">필요한 물품 요청하기</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          <section>
            <label className="block text-xl font-bold text-gray-800 mb-4">카테고리 선택</label>
            <div className="flex flex-wrap gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-5 py-3 rounded-2xl font-bold transition-all border-2 ${
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
            <label className="block text-xl font-bold text-gray-800 mb-4">찾는 물품 이름</label>
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
