import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPickupRequest, fetchPost, getPostImageUrl, hasAuthToken } from '../api/client';
import PostImage from './PostImage';

function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function AppointmentRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get('postId');
  const postType = searchParams.get('type') || 'donate';
  const isEasyMode = searchParams.get('easy') === '1';
  const listPath = isEasyMode ? '/easy-main' : '/buyer-main';
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(postId));
  const [appointment, setAppointment] = useState({
    date: getDefaultDate(),
    time: '15:00',
    memo: '',
  });

  useEffect(() => {
    let ignore = false;

    async function loadPost() {
      if (!postId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchPost(postId, postType);

        if (!ignore) {
          setItem({
            ...data,
            image: getPostImageUrl(data),
            imageUrl: getPostImageUrl(data),
          });
        }
      } catch (error) {
        if (!ignore) {
          setItem(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadPost();

    return () => {
      ignore = true;
    };
  }, [postId, postType]);

  const displayItem = useMemo(
    () => item || {
      title: '선택한 물품',
      description: '후원자에게 받을 물품입니다.',
      category: '나눔 물품',
    },
    [item],
  );

  const handleChange = (field) => (event) => {
    setAppointment((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!postId) {
      alert('요청할 나눔글을 찾을 수 없습니다.');
      return;
    }

    if (!appointment.date || !appointment.time) {
      alert('희망 날짜와 시간을 선택해주세요.');
      return;
    }

    if (!hasAuthToken()) {
      alert('회원코드 인증 후 다시 수령 요청해주세요.');
      navigate(`/code-login?postId=${postId}&type=${postType}${isEasyMode ? '&easy=1' : ''}`, { replace: true });
      return;
    }

    try {
      await createPickupRequest(postId, {
        date: appointment.date,
        time: appointment.time,
        memo: appointment.memo,
      });

      alert('비대면 수령 요청을 보냈습니다.');
      navigate(listPath, { replace: true });
    } catch (error) {
      alert(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-[34px] font-bold text-gray-500">
        수령 요청 화면을 준비하고 있어요...
      </div>
    );
  }

  return (
    <main
      className="appointment-screen bg-[#f7f7f4] h-screen overflow-hidden p-8"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <section className="appointment-card mx-auto grid h-full w-full max-w-[1360px] grid-cols-[0.95fr_1.2fr] gap-8 rounded-[36px] bg-white p-8 shadow-sm border border-gray-100">
        <aside className="appointment-summary flex min-w-0 flex-col rounded-[28px] bg-[#f7f7f4] p-7">
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="mb-6 self-start text-[22px] font-bold text-gray-500 active:scale-95"
          >
            ← 목록으로
          </button>

          <div className="appointment-image mb-6 overflow-hidden rounded-[24px] bg-gray-100">
            <PostImage item={displayItem} alt={displayItem.title} className="h-full w-full object-cover" />
          </div>

          <div className="min-w-0">
            <span className="mb-4 inline-flex rounded-[18px] bg-[#e9f5ee] px-5 py-2 text-[20px] font-bold text-[#2f7d4f]">
              비대면 수령
            </span>
            <h1 className="mb-4 text-[38px] font-black leading-tight text-[#111827] word-keep">
              {displayItem.title}
            </h1>
            <p className="appointment-description mb-6 text-[22px] font-bold leading-snug text-gray-500 word-keep">
              {displayItem.description || displayItem.content || '후원자가 확인하면 보관함 수령 일정이 정해집니다.'}
            </p>
            <div className="appointment-category rounded-[22px] bg-white p-5">
              <p className="text-[18px] font-bold text-gray-500">카테고리</p>
              <p className="mt-2 text-[26px] font-black text-[#222]">{displayItem.category || '나눔 물품'}</p>
            </div>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="appointment-form flex min-w-0 flex-col">
          <div className="appointment-heading mb-8">
            <p className="mb-3 text-[24px] font-black text-[#2f7d4f]">비대면 수령 요청</p>
            <h2 className="text-[52px] font-black leading-tight text-[#111827] word-keep">
              보관함에 넣어둘 시간을 요청해요
            </h2>
            <p className="mt-4 text-[24px] font-bold leading-snug text-gray-500 word-keep">
              원하는 날짜와 시간을 적으면 후원자가 확인합니다.
            </p>
          </div>

          <div className="mb-6 rounded-[24px] bg-[#e9f5ee] px-6 py-5 text-[22px] font-bold leading-snug text-[#2f7d4f] word-keep">
            요청한 날짜에 다시 방문해주세요. 보관함 준비 상태는 앱에서도 확인할 수 있습니다.
          </div>

          <div className="appointment-fields grid flex-1 min-h-0 grid-cols-2 gap-5">
            <label className="flex min-w-0 flex-col gap-3 text-[22px] font-black text-[#222]">
              희망 날짜
              <input
                type="date"
                value={appointment.date}
                onChange={handleChange('date')}
                className="rounded-[22px] border-2 border-gray-100 bg-white px-5 py-5 text-[26px] font-bold outline-none focus:border-[#2f7d4f]"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-3 text-[22px] font-black text-[#222]">
              희망 시간
              <input
                type="time"
                value={appointment.time}
                onChange={handleChange('time')}
                className="rounded-[22px] border-2 border-gray-100 bg-white px-5 py-5 text-[26px] font-bold outline-none focus:border-[#2f7d4f]"
              />
            </label>
            <label className="col-span-2 flex min-w-0 flex-col gap-3 text-[22px] font-black text-[#222]">
              요청 메모
              <textarea
                value={appointment.memo}
                onChange={handleChange('memo')}
                placeholder="예: 가능하면 오후 3시 이후에 보관함에 넣어주세요"
                className="min-h-[150px] resize-none rounded-[22px] border-2 border-gray-100 bg-white px-5 py-5 text-[24px] font-bold outline-none focus:border-[#2f7d4f]"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-7 w-full rounded-[28px] bg-[#2f7d4f] py-6 text-[34px] font-black text-white shadow-lg active:scale-[0.98]"
          >
            비대면 수령 요청하기
          </button>
        </form>
      </section>
    </main>
  );
}

export default AppointmentRequest;
