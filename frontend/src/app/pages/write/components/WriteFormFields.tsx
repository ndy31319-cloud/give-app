import { Camera, MapPin, X } from "lucide-react";
import { useId, useMemo } from "react";
import { useNavigate } from "react-router";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

interface FormData {
  title: string;
  category: string;
  description: string;
  location: string;
}

interface WriteFormFieldsProps {
  formData: FormData;
  onFormChange: (data: FormData) => void;
  postType: string;
  imageFile: File | null;
  onImageChange: (file: File | null) => void;
  aiCheckResult: "checking" | "safe" | "unsafe" | null;
}

export function WriteFormFields({
  formData,
  onFormChange,
  postType,
  imageFile,
  onImageChange,
  aiCheckResult,
}: WriteFormFieldsProps) {
  const navigate = useNavigate();
  const inputId = useId();
  const imagePreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile],
  );

  return (
    <div className="px-4 py-6">
      <div className="space-y-6">
        <div>
          <label
            htmlFor={inputId}
            className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-600 transition-colors"
          >
            {imagePreviewUrl ? (
              <div className="space-y-3">
                <img
                  src={imagePreviewUrl}
                  alt="업로드 미리보기"
                  className="mx-auto max-h-52 rounded-lg object-cover"
                />
                <p className="text-sm text-gray-700">{imageFile?.name}</p>
              </div>
            ) : (
              <>
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">사진 추가 (최대 1장)</p>
              </>
            )}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onImageChange(e.target.files?.[0] || null)}
          />

          <div className="mt-2 flex items-center gap-3 text-xs">
            {aiCheckResult === "checking" && <span className="text-amber-600">AI 검사 중...</span>}
            {aiCheckResult === "safe" && <span className="text-green-600">AI 검사 통과</span>}
            {aiCheckResult === "unsafe" && <span className="text-red-600">위험 물품으로 감지됨</span>}
            {imageFile && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                onClick={() => onImageChange(null)}
              >
                <X className="w-3 h-3" />
                사진 제거
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">제목</label>
          <Input
            type="text"
            value={formData.title}
            onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
            placeholder={
              postType === "share"
                ? "나눔할 물품 제목을 입력하세요"
                : "필요한 물품 제목을 입력하세요"
            }
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">카테고리</label>
          <Select
            value={formData.category}
            onValueChange={(value) => onFormChange({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="카테고리를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clothing">의류/잡화</SelectItem>
              <SelectItem value="electronics">전자제품</SelectItem>
              <SelectItem value="furniture">가구/인테리어</SelectItem>
              <SelectItem value="books">도서</SelectItem>
              <SelectItem value="household">생활용품</SelectItem>
              <SelectItem value="food">식품</SelectItem>
              <SelectItem value="toys">장난감/취미</SelectItem>
              <SelectItem value="etc">기타</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">설명</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md min-h-[150px]"
            value={formData.description}
            onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
            placeholder={
              postType === "share"
                ? "물품 상태와 전달 가능한 내용을 적어주세요"
                : "필요한 이유와 원하는 상태를 적어주세요"
            }
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">거래 희망 장소</label>
          <button
            type="button"
            onClick={() => navigate("/location-select")}
            className="w-full px-4 py-3 border border-gray-300 rounded-md flex items-center justify-between hover:border-blue-600 transition-colors"
          >
            <div className="flex items-center text-gray-700">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" />
              {formData.location}
            </div>
            <span className="text-sm text-gray-500">변경</span>
          </button>
        </div>
      </div>
    </div>
  );
}
