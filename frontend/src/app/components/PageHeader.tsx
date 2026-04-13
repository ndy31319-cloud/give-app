import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  rightContent?: ReactNode;
}

export function PageHeader({ title, showBackButton = true, rightContent }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between p-4">
        {showBackButton ? (
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
        {rightContent || <div className="w-10" />}
      </div>
    </header>
  );
}
