import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signupMember } from '../api/client';

function SignupBuyer() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
  });
  const [issuedCode, setIssuedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      const result = await signupMember({
        name: formData.name.trim(),
        nickname: formData.nickname.trim() || formData.name.trim(),
        phone: formData.phone.trim(),
      });
      setIssuedCode(result.code || result.certificate_number);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-[#F9FAFB] h-screen flex items-center justify-center p-10 overflow-hidden"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
    >
      <div className="bg-white w-full max-w-[720px] rounded-[40px] shadow-sm p-14 border border-gray-100">
        <button
          type="button"
          onClick={() => navigate('/buyer-select')}
          className="mb-12 text-[24px] font-bold text-gray-500"
        >
          ← 돌아가기
        </button>

        {issuedCode ? (
          <div className="text-center py-10">
            <h1 className="text-[48px] font-bold text-[#333] mb-8">회원가입 완료</h1>
            <p className="text-[26px] text-gray-500 mb-10 leading-snug">
              물품을 받을 때 아래 회원코드를 입력해주세요
            </p>
            <div className="bg-[#E9F0FF] border-4 border-[#0047FF] rounded-[32px] py-10 mb-12">
              <p className="text-[24px] font-bold text-[#0047FF] mb-4">발급된 회원코드</p>
              <p className="text-[72px] font-bold text-[#0047FF] tracking-[0.12em]">
                {issuedCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/buyer-select')}
              className="w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="text-center mb-12">
              <h1 className="text-[48px] font-bold text-[#333] mb-5">회원가입</h1>
              <p className="text-[24px] text-gray-500 leading-snug">
                정보를 입력하면 회원코드를 발급해드려요
              </p>
            </div>

            <div className="space-y-7">
              <div>
                <label className="text-[20px] font-bold text-[#333] block mb-3">이름</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="이름을 입력하세요"
                  className="w-full border-2 border-gray-100 rounded-[20px] px-6 py-5 text-[24px] outline-none focus:border-[#0047FF]"
                />
              </div>

              <div>
                <label className="text-[20px] font-bold text-[#333] block mb-3">닉네임</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="닉네임을 입력하세요"
                  className="w-full border-2 border-gray-100 rounded-[20px] px-6 py-5 text-[24px] outline-none focus:border-[#0047FF]"
                />
              </div>

              <div>
                <label className="text-[20px] font-bold text-[#333] block mb-3">전화번호</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="전화번호를 입력하세요"
                  className="w-full border-2 border-gray-100 rounded-[20px] px-6 py-5 text-[24px] outline-none focus:border-[#0047FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0047FF] text-white py-6 rounded-[24px] text-[30px] font-bold mt-12 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {isLoading ? '발급 중...' : '회원코드 발급받기'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SignupBuyer;
