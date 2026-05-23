import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPost } from '../api/client';

function PostDetail() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function loadPost() {
      try {
        setIsLoading(true);
        const data = await fetchPost(postId);

        if (!ignore) {
          setItem(data);
        }
      } catch (error) {
        if (!ignore) {
          alert(`물품 정보를 불러오지 못했습니다: ${error.message}`);
          navigate('/buyer-main');
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
  }, [navigate, postId]);

  const handleReceive = () => {
    const isConfirmed = window.confirm('이 물품을 받으시겠습니까?');

    if (isConfirmed) {
      navigate(`/code-login?postId=${postId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-[36px] font-bold text-gray-500">
        물품 정보를 불러오는 중입니다...
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div
      className="bg-[#F4F6F8] h-screen overflow-hidden p-12"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="h-full bg-white rounded-[36px] shadow-sm border border-gray-100 overflow-hidden flex">
        <div className="w-[52%] bg-gray-100">
          <img
            src={item.image || item.img}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 p-14 flex flex-col">
          <button
            type="button"
            onClick={() => navigate('/buyer-main')}
            className="self-start mb-14 text-[24px] font-bold text-gray-500 active:scale-95"
          >
            ← 목록으로
          </button>

          <div className="flex-1">
            <div className="inline-flex bg-[#E9F0FF] text-[#0047FF] px-6 py-3 rounded-[20px] text-[24px] font-bold mb-8">
              나눔 가능
            </div>
            <h1 className="text-[58px] font-bold text-[#222] leading-tight mb-8">
              {item.title}
            </h1>
            <p className="text-[28px] text-gray-600 leading-relaxed mb-10">
              {item.description || '등록된 물품 상세 정보입니다.'}
            </p>

            <div className="bg-[#F8F9FA] rounded-[28px] p-8">
              <p className="text-[24px] text-gray-500 mb-3">카테고리</p>
              <p className="text-[32px] font-bold text-[#333]">{item.category}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReceive}
            className="w-full bg-[#22C55E] text-white rounded-[28px] py-7 text-[36px] font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            물품 받기
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostDetail;
