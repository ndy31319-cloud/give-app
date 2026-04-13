import { Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";

interface AIImageSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIImageSearch({ open, onOpenChange }: AIImageSearchProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI 이미지 검색</DialogTitle>
          <DialogDescription>
            사진을 업로드하면 AI가 유사한 물품을 찾아드립니다
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
            <Camera className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-2">사진 업로드 또는 촬영</p>
            <p className="text-xs text-gray-500">AI가 자동으로 물품을 인식합니다</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">AI가 분석 중...</span>
              <br />
              업로드된 이미지를 분석하여 유사한 물품을 찾고 있습니다.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            닫기
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">
            검색하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
