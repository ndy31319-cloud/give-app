import React from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import CodeLogin from './auth/code_login';
import AppointmentRequest from './buyer/AppointmentRequest';
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
import LockerMenu from './locker/LockerMenu';
import LockerPickup from './locker/LockerPickup';
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
      className="home-screen bg-gradient-to-b from-[#e9f5ee] to-white min-h-screen flex flex-col w-full p-10 overflow-hidden relative"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0' }}
    >
      <button
        type="button"
        onClick={() => navigate('/locker')}
        className="home-support-button home-locker-button absolute top-10 left-10 bg-white text-[#177245] border-4 border-[#177245] px-9 py-5 rounded-[32px] text-[28px] font-bold shadow-lg active:scale-95"
      >
        물품보관함
      </button>

      <button
        type="button"
        onClick={() => navigate('/easy-main')}
        className="home-support-button home-easy-button absolute top-10 right-10 bg-white text-[#2f7d4f] border-4 border-[#2f7d4f] px-12 py-7 rounded-[36px] text-[34px] font-bold shadow-lg active:scale-95"
      >
        쉬운화면
      </button>

      <div className="home-main-area flex-1 flex flex-col items-center justify-center w-full">
        <button
          type="button"
          onClick={toggleFullScreen}
          className="home-title-button"
        >
          무료 나눔 플랫폼
        </button>
        <p className="home-lead text-[#2f7d4f] font-bold text-center">
          아래 큰 버튼을 눌러 시작하세요
        </p>

        <div className="home-primary-wrap w-full flex justify-center px-4">
          <button
            type="button"
            onClick={() => navigate('/buyer-main')}
            className="home-primary-action w-full bg-white rounded-[48px] shadow-[0_20px_60px_rgba(25, 31, 27, 0.08)] hover:scale-[1.02] hover:shadow-[0_24px_70px_rgba(25, 31, 27, 0.12)] transition-all flex flex-col items-center border border-[#e9f5ee] group py-20"
          >
            <div className="home-primary-icon bg-[#e9f5ee] rounded-full flex items-center justify-center group-hover:bg-[#e9f5ee] transition-colors w-56 h-56 mb-12">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12v8H4v-8" />
                <path d="M22 7H2v5h20V7Z" />
                <path d="M12 22V7" />
                <path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5C10 6 12 7 12 7Z" />
                <path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5C14 6 12 7 12 7Z" />
              </svg>
            </div>

            <h2 className="font-black text-[#111827] mb-6 text-[56px]">
              필요한 물건 보기
            </h2>
            <p className="text-gray-600 text-center leading-tight text-[28px] font-bold">
              사진을 보고 받을 물건을 고르세요
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
        <Route path="/locker" element={<LockerMenu />} />
        <Route path="/locker/store" element={<LockerScreen />} />
        <Route path="/locker/pickup" element={<LockerPickup />} />

        <Route path="/seller-home" element={<SellerHome />} />
        <Route path="/mypage-seller" element={<MypageSeller />} />
        <Route path="/seller-input" element={<SellerInput />} />

        <Route path="/buyer-select" element={<BuyerSelect />} />
        <Route path="/buyer-main" element={<MainScreen />} />
        <Route path="/posts/:postId" element={<PostDetail />} />
        <Route path="/code-login" element={<CodeLogin />} />
        <Route path="/appointment-request" element={<AppointmentRequest />} />
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
