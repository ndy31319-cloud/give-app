import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function SellerInput() {
  const navigate = useNavigate();
  
 
  const fileInputRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);


  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      
      const imageUrl = URL.createObjectURL(file);
      setImagePreview(imageUrl);
    }
  };

 
  const handleImageClick = () => {
    fileInputRef.current.click();
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    alert('나눔 물품이 성공적으로 등록되었습니다!');
    navigate('/seller-home');
  };


  const selectStyle = {
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23999'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 1.5rem center',
    backgroundSize: '1.5rem'
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen p-8" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      
      {/* 헤더 영역 */}
      <div className="flex items-center gap-6 mb-10">
        <button onClick={() => navigate('/seller-home')} className="hover:bg-gray-100 p-2 rounded-full transition-all">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 className="text-[36px] font-bold text-[#333]">나눔 물품 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 pb-20">
        
        {/* 왼쪽: 사진 업로드 영역 */}
        <div className="space-y-4">
          <label className="text-[22px] font-bold text-[#333] ml-2">물품 사진 (최대 1장)</label>
          <div 
            onClick={handleImageClick} 
            className="w-full aspect-square rounded-[32px] flex flex-col items-center justify-center overflow-hidden relative bg-white shadow-sm border-[3px] border-dashed border-[#D1D5DB] hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all cursor-pointer"
          >
            {/* 이미지가 있으면 이미지 표시, 없으면 아이콘 표시 */}
            {imagePreview ? (
              <img src={imagePreview} alt="미리보기" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-6">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <p className="text-[20px] font-bold text-gray-500">사진을 등록해주세요</p>
                <p className="text-[16px] text-gray-400 mt-2">여기를 터치하여 촬영하거나 선택하세요</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageChange} 
            />
          </div>
        </div>

        {/* 오른쪽: 입력 폼 영역 */}
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[22px] font-bold text-[#333] ml-2">제목</label>
            <div className="border-2 border-[#E5E7EB] rounded-[20px] transition-all bg-white focus-within:border-[#22C55E] px-6 py-5">
              <input type="text" placeholder="나눔 물품 제목을 입력하세요" required className="w-full text-[20px] outline-none placeholder:text-gray-300" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[22px] font-bold text-[#333] ml-2">카테고리</label>
            <div className="border-2 border-[#E5E7EB] rounded-[20px] transition-all bg-white focus-within:border-[#22C55E] px-6 py-5">
              <select defaultValue="" required style={selectStyle} className="w-full text-[20px] outline-none bg-transparent text-gray-500">
                <option value="" disabled>카테고리를 선택하세요</option>
                <option value="digital">디지털/가전</option>
                <option value="furniture">가구/인테리어</option>
                <option value="fashion">패션/의류</option>
                <option value="book">도서</option>
                <option value="sports">스포츠/레저</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[22px] font-bold text-[#333] ml-2">물품 상태</label>
            <div className="border-2 border-[#E5E7EB] rounded-[20px] transition-all bg-white focus-within:border-[#22C55E] px-6 py-5">
              <select defaultValue="" required style={selectStyle} className="w-full text-[20px] outline-none bg-transparent text-gray-500">
                <option value="" disabled>상태를 선택하세요</option>
                <option value="new">미개봉 새상품</option>
                <option value="best">사용감 거의 없음</option>
                <option value="good">보통 수준의 사용감</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[22px] font-bold text-[#333] ml-2">나눔 지역</label>
            <div className="border-2 border-[#E5E7EB] rounded-[20px] transition-all bg-white focus-within:border-[#22C55E] px-6 py-5">
              <input type="text" placeholder="나눔 지역을 입력하세요" required className="w-full text-[20px] outline-none placeholder:text-gray-300" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[22px] font-bold text-[#333] ml-2">물품 설명</label>
            <div className="border-2 border-[#E5E7EB] rounded-[20px] transition-all bg-white focus-within:border-[#22C55E] px-6 py-5">
              <textarea placeholder="나눔 물품에 대한 설명을 입력하세요" rows="4" required className="w-full text-[20px] outline-none placeholder:text-gray-300 resize-none"></textarea>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className="w-full bg-[#22C55E] text-white py-6 rounded-[28px] text-[24px] font-bold shadow-lg active:scale-[0.98] transition-all hover:bg-[#1ea951]">
              등록 완료
            </button>
          </div>
        </div>
      </form>

    </div>
  );
}

export default SellerInput;