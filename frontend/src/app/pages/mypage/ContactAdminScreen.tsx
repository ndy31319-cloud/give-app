import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";

export function ContactAdminScreen() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    email: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 문의 제출 로직
    alert("문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.");
    navigate("/mypage");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">관리자에게 문의하기</h1>
        </div>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">제목</label>
            <Input
              type="text"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="문의 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              연락받을 이메일
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="example@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">문의 내용</label>
            <Textarea
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              placeholder="문의하실 내용을 자세히 적어주세요"
              className="min-h-[200px]"
              required
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">안내사항</span>
              <br />
              평일 09:00 ~ 18:00 (주말, 공휴일 제외)
              <br />
              문의하신 내용은 영업일 기준 1~2일 내 답변드립니다.
            </p>
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            문의하기
          </Button>
        </form>
      </div>
    </div>
  );
}
