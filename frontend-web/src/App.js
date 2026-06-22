import React from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import CodeLogin from './auth/code_login';
import ReceiveSuccess from './auth/ReceiveSuccess';
import BuyerSelect from './buyer/BuyerSelect';
import BuyerEdit from './buyer/buyer_edit';
import EasyMainScreen from './buyer/EasyMainScreen';
import EasyWantedList from './buyer/EasyWantedList';
import EasyWriteWanted from './buyer/EasyWriteWanted';
import History from './buyer/history';
import MypageBuyer from './buyer/mypage_buyer';
import PostDetail from './buyer/PostDetail';
import SettingsBuyer from './buyer/settings_buyer';
import WantedList from './buyer/wanted_list';
import Wishlist from './buyer/wishlist';
import WriteWanted from './buyer/write_wanted';
import LockerScreen from './locker/LockerScreen';
import MainScreen from './Mainscreen';
import SellerInput from './seller/input';
import SellerHome from './seller/seller_home';
import MypageSeller from './seller/mypage_seller';

function Home() {
  const navigate = useNavigate();

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((error) => {
        console.log('전체화면 오류:', error);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <div
      className="home-screen bg-gradient-to-b from-[#E9F0FF] to-white min-h-screen flex flex-col w-full p-10 overflow-hidden relative"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '-0.03em' }}
    >
      <button
        type="button"
        onClick={() => navigate('/locker')}
        className="absolute top-10 left-10 bg-white text-[#2E8B57] border-4 border-[#2E8B57] px-9 py-5 rounded-[32px] text-[28px] font-bold shadow-lg active:scale-95"
      >
        물품보관함
      </button>

      <button
        type="button"
        onClick={() => navigate('/easy-main')}
        className="absolute top-10 right-10 bg-white text-[#0047FF] border-4 border-[#0047FF] px-9 py-5 rounded-[32px] text-[28px] font-bold shadow-lg active:scale-95"
      >
        쉬운모드
      </button>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <h1
          onClick={toggleFullScreen}
          className="font-bold text-[#0047FF] mb-4 text-[72px] cursor-pointer text-center leading-tight"
        >
          무료 나눔 플랫폼
        </h1>
        <p className="text-[#666666] mb-16 font-medium text-[32px] text-center">
          화면을 터치해서 시작해주세요
        </p>

        <div className="w-full flex justify-center px-4">
          <button
            type="button"
            onClick={() => navigate('/buyer-main')}
            className="w-full max-w-[600px] bg-white rounded-[48px] shadow-[0_20px_60px_rgba(0,71,255,0.08)] hover:scale-[1.02] hover:shadow-[0_24px_70px_rgba(0,71,255,0.15)] transition-all flex flex-col items-center border border-[#E9F0FF] group py-20"
          >
            <div className="bg-[#E9F0FF] rounded-full flex items-center justify-center group-hover:bg-[#D4E4FF] transition-colors w-56 h-56 mb-12">
              <svg className="w-[120px] h-[120px]" viewBox="0 0 24 24" fill="none" stroke="#0047FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>

            <h2 className="font-bold text-[#333333] mb-6 text-[56px]">
              필요한 물품 찾기
            </h2>
            <p className="text-gray-500 text-center leading-tight text-[28px]">
              여기를 눌러서<br />도움을 받아보세요
            </p>
          </button>
        </div>
      </div>

      <div className="w-full shrink-0 mt-auto" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/locker" element={<LockerScreen />} />

        <Route path="/seller-home" element={<SellerHome />} />
        <Route path="/mypage-seller" element={<MypageSeller />} />
        <Route path="/seller-input" element={<SellerInput />} />

        <Route path="/buyer-select" element={<BuyerSelect />} />
        <Route path="/buyer-main" element={<MainScreen />} />
        <Route path="/posts/:postId" element={<PostDetail />} />
        <Route path="/code-login" element={<CodeLogin />} />
        <Route path="/receive-success" element={<ReceiveSuccess />} />
        <Route path="/easy-main" element={<EasyMainScreen />} />
        <Route path="/easy-wanted" element={<EasyWantedList />} />
        <Route path="/easy-write-wanted" element={<EasyWriteWanted />} />
        <Route path="/mypage-buyer" element={<MypageBuyer />} />
        <Route path="/wanted" element={<WantedList />} />
        <Route path="/write-wanted" element={<WriteWanted />} />
        <Route path="/Write-Wanted" element={<WriteWanted />} />
        <Route path="/buyer-edit" element={<BuyerEdit />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<SettingsBuyer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
