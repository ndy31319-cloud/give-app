import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { Button } from "@/app/components/ui/button";

interface FilterState {
  type: string;
  status: string;
  distance: string;
}

interface SearchFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
}

export function SearchFilter({ open, onOpenChange, filters, onFilterChange, onApply, onReset }: SearchFilterProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>검색 필터</SheetTitle>
          <SheetDescription>
            원하는 조건으로 검색 결과를 필터링하세요
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(100vh-180px)]">
          {/* 게시글 유형 */}
          <div>
            <h3 className="font-semibold mb-3">게시글 유형</h3>
            <div className="space-y-2">
              {[
                { value: "all", label: "전체" },
                { value: "share", label: "나눔해요" },
                { value: "need", label: "필요해요" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFilterChange({ ...filters, type: option.value })
                  }
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                    filters.type === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 */}
          <div>
            <h3 className="font-semibold mb-3">상태</h3>
            <div className="space-y-2">
              {[
                { value: "all", label: "전체" },
                { value: "available", label: "나눔 가능" },
                { value: "reserved", label: "예약중" },
                { value: "completed", label: "나눔완료" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFilterChange({ ...filters, status: option.value })
                  }
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                    filters.status === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 거리 */}
          <div>
            <h3 className="font-semibold mb-3">거리</h3>
            <div className="space-y-2">
              {[
                { value: "all", label: "전체" },
                { value: "1km", label: "1km 이내" },
                { value: "3km", label: "3km 이내" },
                { value: "5km", label: "5km 이내" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFilterChange({ ...filters, distance: option.value })
                  }
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                    filters.distance === option.value
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onReset}
            className="flex-1"
          >
            초기화
          </Button>
          <Button onClick={onApply} className="flex-1 bg-blue-600">
            적용하기
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
