import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { AICheckDialog } from "./components/AICheckDialog";
import { WriteFormFields } from "./components/WriteFormFields";
import { postAPI } from "@/app/services/api";

type AiCheckResult = "checking" | "safe" | "unsafe" | null;

export function WriteFormScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postType = searchParams.get("type") === "need" ? "need" : "share";
  const [aiCheckDialogOpen, setAiCheckDialogOpen] = useState(false);
  const [aiCheckResult, setAiCheckResult] = useState<AiCheckResult>(null);
  const [aiCheckReason, setAiCheckReason] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    location: "역삼동",
  });

  const runAiCheck = async (file: File) => {
    setAiCheckDialogOpen(true);
    setAiCheckResult("checking");
    setAiCheckReason("");

    const result = await postAPI.checkHarmfulItem(file);

    if (result.error || !result.data) {
      setAiCheckResult("unsafe");
      setAiCheckReason(result.error || "AI 판독 중 오류가 발생했습니다.");
      return false;
    }

    if (result.data.isHarmful) {
      setAiCheckResult("unsafe");
      setAiCheckReason(result.data.reason || "위험 물품으로 분류되었습니다.");
      return false;
    }

    setAiCheckResult("safe");
    setAiCheckReason(result.data.reason || "");
    return true;
  };

  const handleImageChange = async (file: File | null) => {
    setImageFile(file);
    setSubmitError("");

    if (!file) {
      setAiCheckResult(null);
      setAiCheckReason("");
      setAiCheckDialogOpen(false);
      return;
    }

    await runAiCheck(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.category || !formData.description.trim()) {
      setSubmitError("제목, 카테고리, 설명을 모두 입력해주세요.");
      return;
    }

    if (postType === "share" && !imageFile) {
      setSubmitError("나눔 글은 사진이 필요합니다.");
      return;
    }

    if (imageFile && aiCheckResult !== "safe") {
      const isSafe = await runAiCheck(imageFile);

      if (!isSafe) {
        setSubmitError("AI 판독을 통과한 뒤 등록할 수 있습니다.");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError("");

    const result = await postAPI.createPost({
      title: formData.title,
      description: formData.description,
      category: formData.category,
      postType,
      imageFile,
    });

    setIsSubmitting(false);

    if (result.error || !result.data) {
      setSubmitError(result.error || "게시글 등록에 실패했습니다.");
      return;
    }

    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-4 text-lg font-semibold">
            {postType === "share" ? "나눔해요" : "필요해요"}
          </h1>
        </div>
        <Button
          onClick={handleSubmit}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? "등록 중..." : "완료"}
        </Button>
      </div>

      <WriteFormFields
        formData={formData}
        onFormChange={setFormData}
        postType={postType}
        imageFile={imageFile}
        onImageChange={handleImageChange}
        aiCheckResult={aiCheckResult}
      />

      {submitError && <p className="px-4 pb-4 text-sm text-red-600">{submitError}</p>}

      <AICheckDialog
        open={aiCheckDialogOpen}
        onOpenChange={setAiCheckDialogOpen}
        result={aiCheckResult}
        reason={aiCheckReason}
      />
    </div>
  );
}
