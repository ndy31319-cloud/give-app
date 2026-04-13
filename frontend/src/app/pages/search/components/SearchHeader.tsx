import { Search, SlidersHorizontal, Camera } from "lucide-react";
import { Input } from "@/app/components/ui/input";

interface SearchHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterClick: () => void;
  onCameraClick: () => void;
}

export function SearchHeader({ searchQuery, onSearchChange, onFilterClick, onCameraClick }: SearchHeaderProps) {
  return (
    <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="어떤 물품을 찾으시나요?"
              className="pl-10"
            />
          </div>
          <button onClick={onFilterClick} className="p-2 border border-gray-300 rounded-md">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <button onClick={onCameraClick} className="p-2 border border-gray-300 rounded-md">
            <Camera className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
