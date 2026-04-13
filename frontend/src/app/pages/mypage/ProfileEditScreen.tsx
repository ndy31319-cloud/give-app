import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Camera, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";

export function ProfileEditScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "홍길동",
    phone: "010-1234-5678",
    email: "hong@example.com",
    bio: "안녕하세요! 나눔을 통해 더 따뜻한 세상을 만들어가요.",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 프론트엔드에서만 처리
    console.log("프로필 업데이트:", formData);
    navigate("/mypage");
  };

  const handleImageUpload = () => {
    // 프론트엔드에서만 처리 - 실제로는 파일 선택 다이얼로그 열기
    console.log("이미지 업로드");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate("/mypage")} className="mr-3">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">프로필 수정</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4">
        {/* Profile Image */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-gray-500" />
            </div>
            <button
              type="button"
              onClick={handleImageUpload}
              className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">프로필 사진 변경</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone">전화번호</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="bio">자기소개</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              className="mt-1"
              rows={4}
              placeholder="자신을 소개하는 글을 작성해주세요"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 space-y-2">
          <Button type="submit" className="w-full bg-blue-600">
            저장하기
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/mypage")}
            className="w-full"
          >
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}