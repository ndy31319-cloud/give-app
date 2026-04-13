import { PenSquare } from "lucide-react";
import { useNavigate } from "react-router";

export function FloatingWriteButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/write")}
      className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all hover:scale-110"
    >
      <PenSquare className="w-6 h-6" />
    </button>
  );
}
