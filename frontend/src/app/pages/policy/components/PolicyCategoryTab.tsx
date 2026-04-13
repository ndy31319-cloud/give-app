import { PolicyCard } from "./PolicyCard";

interface Policy {
  id: string;
  title: string;
  category: string;
  description: string;
  target: string;
  support: string;
  targetTypes?: string[];
}

interface PolicyCategoryTabProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  policies: Policy[];
}

export function PolicyCategoryTab({ categories, selectedCategories, onCategoryToggle, policies }: PolicyCategoryTabProps) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">카테고리 선택</h2>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryToggle(category)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                selectedCategories.includes(category)
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {selectedCategories.length > 0 && (
        <div className="mb-3">
          <p className="text-sm text-gray-600">
            선택된 카테고리: {selectedCategories.join(", ")}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.id}
            id={policy.id}
            title={policy.title}
            category={policy.category}
            description={policy.description}
            target={policy.target}
            support={policy.support}
          />
        ))}
      </div>
    </div>
  );
}
