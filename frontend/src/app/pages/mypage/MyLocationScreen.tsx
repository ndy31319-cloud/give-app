import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

interface Location {
  id: string;
  name: string;
  address: string;
}

export function MyLocationScreen() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("역삼동");

  const mockLocations: Location[] = [
    { id: "1", name: "역삼동", address: "서울특별시 강남구 역삼동" },
    { id: "2", name: "삼성동", address: "서울특별시 강남구 삼성동" },
    { id: "3", name: "서초동", address: "서울특별시 서초구 서초동" },
    { id: "4", name: "방배동", address: "서울특별시 서초구 방배동" },
    { id: "5", name: "잠실동", address: "서울특별시 송파구 잠실동" },
  ];

  const filteredLocations = searchQuery
    ? mockLocations.filter(
        (loc) =>
          loc.name.includes(searchQuery) || loc.address.includes(searchQuery)
      )
    : mockLocations;

  const handleSave = () => {
    // 프론트엔드에서만 처리
    console.log("선택된 동네:", selectedLocation);
    navigate("/mypage");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate("/mypage")} className="mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">내 동네 설정</h1>
      </div>

      <div className="p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="동네 이름으로 검색"
            className="pl-10"
          />
        </div>

        {/* Current Location */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            현재 설정된 동네
          </h2>
          <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4">
            <div className="flex items-center">
              <MapPin className="w-5 h-5 text-blue-600 mr-2" />
              <div className="flex-1">
                <div className="font-semibold">{selectedLocation}</div>
                <div className="text-sm text-gray-600">
                  서울특별시 강남구 {selectedLocation}
                </div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Location List */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            동네 선택
          </h2>
          <div className="space-y-2">
            {filteredLocations.map((location) => (
              <button
                key={location.id}
                onClick={() => setSelectedLocation(location.name)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedLocation === location.name
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center">
                  <MapPin
                    className={`w-5 h-5 mr-2 ${
                      selectedLocation === location.name
                        ? "text-blue-600"
                        : "text-gray-400"
                    }`}
                  />
                  <div className="flex-1">
                    <div
                      className={`font-semibold ${
                        selectedLocation === location.name
                          ? "text-blue-600"
                          : "text-gray-900"
                      }`}
                    >
                      {location.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {location.address}
                    </div>
                  </div>
                  {selectedLocation === location.name && (
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <Button onClick={handleSave} className="w-full bg-blue-600">
            저장하기
          </Button>
        </div>
      </div>
    </div>
  );
}