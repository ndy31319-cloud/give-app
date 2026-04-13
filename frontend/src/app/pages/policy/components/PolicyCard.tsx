import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";

interface PolicyCardProps {
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
}

export function PolicyCard({ title, category, description, target, support }: PolicyCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          {category}
        </Badge>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <div className="space-y-1 text-sm">
        <div className="flex">
          <span className="text-gray-500 w-20">대상:</span>
          <span className="text-gray-700">{target}</span>
        </div>
        <div className="flex">
          <span className="text-gray-500 w-20">지원:</span>
          <span className="text-gray-700 font-medium">{support}</span>
        </div>
      </div>
      <Button className="w-full mt-3" variant="outline">
        자세히 보기
      </Button>
    </div>
  );
}
