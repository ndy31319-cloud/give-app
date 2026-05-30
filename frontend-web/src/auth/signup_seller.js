import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SignupSeller() {
  const navigate = useNavigate();

  //  리액트의 핵심
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    region: ''
  });

  // 사용자가 글자를 입력할 때마다 창고(formData)의 값을 업데이트하는 함수
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // '가입 완료' 버튼을 눌렀을 때 실행되는 함수 (수요자와 동일하게 구조 통일)
  const handleSubmit = () => {
    // 빈칸 검사 (유효성 검사)
    if (!formData.name || !formData.id || !formData.password) {
      alert('필수 정보를 모두 입력해주세요!');
      return;
    }
    if (formData.password !== formData.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 서버 전송 로직 자리
    console.log("서버로 보낼 데이터:", formData);
    alert('가입이 완료되었습니다!');
    navigate('/login-seller'); // 기부자 로그인으로 이동
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: "-0.05em" }}>
      <div className="bg-white w-full max-w-[600px] rounded-[40px] shadow-sm p-12 flex flex-col">
        
        {/* 뒤로가기 버튼 */}
        <button 
          onClick={() => navigate('/login-seller')} 
          className="mb-10 self-start hover:bg-gray-100 p-2 rounded-full transition-all"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="text-center mb-10">
          {/* 💡 기부자 테마인 초록색(#22C55E) 유지 */}
          <h1 className="text-[42px] font-bold text-[#22C55E] mb-2">기부자 회원가입</h1>
          <p className="text-[18px] text-gray-400">나눔을 위해 정보를 입력해주세요</p>
        </div>

        {/* 💡 form 태그를 제거하고 수요자 코드의 div 스크롤 구조로 통일 */}
        <div className="space-y-6 flex-1 overflow-y-auto pr-2 max-h-[600px]">
          
          {/* 이름 입력 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">이름</label>
            <input 
              type="text" 
              name="name"
              value={formData.name}       // 
              onChange={handleChange}
              placeholder="이름을 입력하세요" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* 아이디 입력 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">아이디</label>
            <input 
              type="text" 
              name="id"
              value={formData.id}
              onChange={handleChange}
              placeholder="아이디를 입력하세요" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* 비밀번호 입력 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">비밀번호</label>
            <input 
              type="password" 
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* 비밀번호 확인 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">비밀번호 확인</label>
            <input 
              type="password" 
              name="passwordConfirm"
              value={formData.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* 전화번호 입력 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">전화번호</label>
            <input 
              type="tel" 
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="전화번호를 입력하세요" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>

          {/* 사는 지역 입력 */}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-[#333] ml-1">사는 지역</label>
            <input 
              type="text" 
              name="region"
              value={formData.region}
              onChange={handleChange}
              placeholder="거주하시는 지역을 입력하세요 (예: 서울 강남구)" 
              className="w-full border-2 border-gray-100 rounded-[15px] px-5 py-4 outline-none focus:border-[#22C55E] transition-colors"
            />
          </div>
        </div>

        {/*  form 제출 대신 버튼 onClick 방식으로 통일 */}
        <button 
          onClick={handleSubmit}
          className="w-full bg-[#22C55E] text-white py-5 rounded-[18px] text-[22px] font-bold mt-10 transition-all hover:bg-green-600 active:scale-[0.98]"
        >
          가입 완료
        </button>
      </div>
    </div>
  );
}

export default SignupSeller;