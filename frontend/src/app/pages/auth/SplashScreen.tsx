import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Heart } from "lucide-react";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // 2초 후 로그인 화면으로 이동
    const timer = setTimeout(() => {
      navigate("/login");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-400 via-blue-100 to-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-2">
          <span className="text-blue-600">Give</span>
          <span className="text-gray-700">,기부</span>
        </h1>
        <p className="text-gray-600 text-lg mt-4">따뜻한 나눔, 함께하는 세상</p>
      </div>
    </div>
  );
}