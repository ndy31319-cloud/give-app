import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function BuyerEdit() {
  const navigate = useNavigate();

  // 입력 필드들의 상태 관리 (기본값 설정)
  const [formData, setFormData] = useState({
    name: '홍길동',
    birth: '1995-05-15',
    phone: '010-1234-5678',
    email: 'user1111@example.com',
    password: ''
  });

  // 입력값이 바뀔 때 실행되는 함수
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // 저장 버튼 클릭 시
  const handleSave = (e) => {
    e.preventDefault();
    alert('수요자 정보가 안전하게 변경되었습니다.');
    navigate('/mypage-buyer'); // 저장 후 마이페이지로 이동
  };

  return (
    <div className="p-6 flex justify-center bg-[#F8F9FA] min-h-screen" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      <div className="w-full max-w-lg bg-white shadow-sm p-8 rounded-[40px] border border-gray-100">
        
        {/* 헤더 */}
        <header className="mb-10 flex items-center gap-4">
          <button 
            onClick={() => navigate('/mypage-buyer')} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">개인정보 수정</h1>
        </header>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-500 ml-1">이름</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-100 rounded-[16px] p-4 text-[18px] outline-none focus:border-[#0047FF] transition-all" 
              placeholder="실명을 입력하세요"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-500 ml-1">생년월일</label>
            <input 
              type="date" 
              name="birth"
              value={formData.birth}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-100 rounded-[16px] p-4 text-[18px] outline-none focus:border-[#0047FF] transition-all" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-500 ml-1">휴대폰 번호</label>
            <div className="flex gap-2">
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="flex-1 bg-white border-2 border-gray-100 rounded-[16px] p-4 text-[18px] outline-none focus:border-[#0047FF] transition-all" 
              />
              <button type="button" className="bg-gray-100 px-4 rounded-xl text-sm font-bold text-gray-500 shrink-0">재인증</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-500 ml-1">이메일 주소</label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-100 rounded-[16px] p-4 text-[18px] outline-none focus:border-[#0047FF] transition-all" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-500 ml-1">비밀번호 변경</label>
            <input 
              type="password" 
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-white border-2 border-gray-100 rounded-[16px] p-4 text-[18px] outline-none focus:border-[#0047FF] transition-all" 
              placeholder="••••••••"
            />
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              className="w-full bg-[#0047FF] text-white py-5 rounded-2xl text-xl font-bold shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform"
            >
              변경사항 저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BuyerEdit;