import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AppProvider } from "@/app/context/AppContext";

// Auth Pages
import { SplashScreen } from "@/app/pages/auth/SplashScreen";
import { LoginScreen } from "@/app/pages/auth/LoginScreen";
import { SignupScreen } from "@/app/pages/auth/SignupScreen";
import { VulnerableSelectScreen } from "@/app/pages/auth/VulnerableSelectScreen";
import { VulnerableInfoScreen } from "@/app/pages/auth/VulnerableInfoScreen";
import { PersonalInfoScreen } from "@/app/pages/auth/PersonalInfoScreen";
import { LocationSettingScreen } from "@/app/pages/auth/LocationSettingScreen";

// Home Pages
import { HomeScreen } from "@/app/pages/home/HomeScreen";
import { PostDetailScreen } from "@/app/pages/home/PostDetailScreen";
import { NotificationsScreen } from "@/app/pages/home/NotificationsScreen";

// Write Pages
import { WriteSelectScreen } from "@/app/pages/write/WriteSelectScreen";
import { WriteFormScreen } from "@/app/pages/write/WriteFormScreen";

// Search Pages
import { SearchScreen } from "@/app/pages/search/SearchScreen";

// Policy Pages
import { PolicyScreen } from "@/app/pages/policy/PolicyScreen";

// Chat Pages
import { ChatListScreen } from "@/app/pages/chat/ChatListScreen";
import { ChatRoomScreen } from "@/app/pages/chat/ChatRoomScreen";

// MyPage
import { MyPageScreen } from "@/app/pages/mypage/MyPageScreen";
import { ProfileEditScreen } from "@/app/pages/mypage/ProfileEditScreen";
import { MyLocationScreen } from "@/app/pages/mypage/MyLocationScreen";
import { MyStatsScreen } from "@/app/pages/mypage/MyStatsScreen";
import { MySharesScreen } from "@/app/pages/mypage/MySharesScreen";
import { SettingsScreen } from "@/app/pages/mypage/SettingsScreen";
import { ContactAdminScreen } from "@/app/pages/mypage/ContactAdminScreen";

// Error Pages
import { NotFoundPage } from "@/app/components/ErrorComponents";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Default redirect to splash */}
          <Route path="/" element={<Navigate to="/splash" replace />} />
          
          {/* Auth Routes */}
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/signup" element={<SignupScreen />} />
          <Route path="/vulnerable-select" element={<VulnerableSelectScreen />} />
          <Route path="/vulnerable-info" element={<VulnerableInfoScreen />} />
          <Route path="/personal-info" element={<PersonalInfoScreen />} />
          <Route path="/location-setting" element={<LocationSettingScreen />} />

          {/* Home Routes */}
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/post/:id" element={<PostDetailScreen />} />
          <Route path="/notifications" element={<NotificationsScreen />} />

          {/* Write Routes */}
          <Route path="/write" element={<WriteSelectScreen />} />
          <Route path="/write/form" element={<WriteFormScreen />} />

          {/* Search Routes */}
          <Route path="/search" element={<SearchScreen />} />

          {/* Policy Routes */}
          <Route path="/policy" element={<PolicyScreen />} />

          {/* Chat Routes */}
          <Route path="/chat" element={<ChatListScreen />} />
          <Route path="/chat/:id" element={<ChatRoomScreen />} />

          {/* MyPage Routes */}
          <Route path="/mypage" element={<MyPageScreen />} />
          <Route path="/profile-edit" element={<ProfileEditScreen />} />
          <Route path="/my-location" element={<MyLocationScreen />} />
          <Route path="/my-stats" element={<MyStatsScreen />} />
          <Route path="/my-shares" element={<MySharesScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/contact-admin" element={<ContactAdminScreen />} />

          {/* 404 - Catch all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}