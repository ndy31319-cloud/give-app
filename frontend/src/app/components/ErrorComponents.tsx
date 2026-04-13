import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="text-center">
        <div className="mb-6">
          <h1 className="text-9xl font-bold text-blue-500">404</h1>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          페이지를 찾을 수 없습니다
        </h2>
        <p className="text-gray-600 mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            이전 페이지
          </Button>
          <Button onClick={() => navigate("/home")}>
            <Home className="mr-2 h-4 w-4" />
            홈으로 가기
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NetworkErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="text-center">
        <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          네트워크 연결 실패
        </h2>
        <p className="text-gray-600 mb-8">
          인터넷 연결을 확인하고 다시 시도해주세요.
        </p>
        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 시도
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: any;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {Icon && <Icon className="w-16 h-16 text-gray-400 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 text-center mb-6">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
