import { MapPin, Bell, Search } from "lucide-react";
import { useNavigate } from "react-router";

export function HomeHeader() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <button className="flex items-center">
          <MapPin className="w-5 h-5 text-blue-600 mr-1" />
          <span className="font-semibold">역삼동</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/search")} className="p-2 hover:bg-gray-100 rounded-full">
            <Search className="w-6 h-6" />
          </button>
          <button onClick={() => navigate("/notifications")}>
            <Bell className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
