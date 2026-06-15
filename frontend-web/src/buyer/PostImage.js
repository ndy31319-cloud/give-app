import React, { useState } from 'react';
import { getPostImageUrl } from '../api/client';

function PostImage({ item, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : getPostImageUrl(item);

  if (!imageUrl) {
    return <div className={`image-placeholder ${className}`}>이미지 없음</div>;
  }

  return (
    <img
      src={imageUrl}
      alt={alt || item?.title || '물품 이미지'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export default PostImage;
