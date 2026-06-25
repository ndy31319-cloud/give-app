import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchPost, getPostImageUrl } from '../api/client';
import PostImage from './PostImage';
import ReceiveConfirmModal from './ReceiveConfirmModal';

function PostDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const postType = searchParams.get('type') || 'donate';
  const isEasyMode = searchParams.get('easy') === '1' || Boolean(location.state?.fromEasyMode);
  const listPath = isEasyMode ? '/easy-main' : '/buyer-main';
  const fallbackPost = location.state?.fallbackPost || null;
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiveConfirmOpen, setReceiveConfirmOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPost() {
      try {
        setIsLoading(true);
        const data = await fetchPost(postId, postType);
        const description =
          data?.description ||
          data?.content ||
          fallbackPost?.description ||
          fallbackPost?.content ||
          '';

        if (!ignore) {
          setItem({
            ...fallbackPost,
            ...data,
            description,
            image: getPostImageUrl(data) || getPostImageUrl(fallbackPost),
            imageUrl: getPostImageUrl(data) || getPostImageUrl(fallbackPost),
          });
        }
      } catch (error) {
        if (!ignore) {
          alert(`물품 정보를 불러오지 못했습니다. ${error.message}`);
          navigate(listPath);
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
  }, [fallbackPost, listPath, navigate, postId, postType]);

  const handleReceive = () => {
    setReceiveConfirmOpen(true);
  };

  const confirmReceive = () => {
    navigate(`/code-login?postId=${postId}&type=${postType}${isEasyMode ? '&easy=1' : ''}`);
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
      className="post-detail-screen bg-[#F4F6F8] h-screen overflow-hidden p-12"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <div className="post-detail-card h-full bg-white rounded-[36px] shadow-sm border border-gray-100 overflow-hidden flex">
        <button
          type="button"
          className="post-detail-image bg-gray-100"
          onClick={() => setImagePreviewOpen(true)}
          aria-label="사진 크게 보기"
        >
          <PostImage item={item} alt={item.title} className="w-full h-full object-cover" />
          <span>사진 크게 보기</span>
        </button>

        <div className="post-detail-info flex-1 p-14 flex flex-col">
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="self-start mb-14 text-[24px] font-bold text-gray-500 active:scale-95"
          >
            ← 목록으로
          </button>

          <div className="flex-1">
            <div className="inline-flex bg-[#E9F0FF] text-[#0047FF] px-6 py-3 rounded-[20px] text-[24px] font-bold mb-8">
              신청가능
            </div>
            <h1 className="text-[58px] font-bold text-[#222] leading-tight mb-8">
              {item.title}
            </h1>
            <p className="text-[28px] text-gray-600 leading-relaxed mb-10">
              {item.description || item.content}
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

      {imagePreviewOpen && (
        <div className="post-image-preview fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8">
          <div className="post-image-preview-card bg-white rounded-[32px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="post-image-preview-image bg-gray-100 rounded-[24px] overflow-hidden">
              <PostImage item={item} alt={item.title} className="w-full h-full object-contain" />
            </div>
            <button
              type="button"
              onClick={() => setImagePreviewOpen(false)}
              className="mt-6 w-full rounded-[24px] bg-[#0057D8] py-5 text-[30px] font-bold text-white active:scale-[0.98]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <ReceiveConfirmModal
        open={receiveConfirmOpen}
        onCancel={() => setReceiveConfirmOpen(false)}
        onConfirm={confirmReceive}
      />
    </div>
  );
}

export default PostDetail;
