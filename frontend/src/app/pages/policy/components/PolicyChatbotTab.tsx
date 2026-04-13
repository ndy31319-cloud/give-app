import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

interface ChatMessage {
  text: string;
  sender: "user" | "bot";
}

interface PolicyChatbotTabProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function PolicyChatbotTab({ messages, inputValue, onInputChange, onSend }: PolicyChatbotTabProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 shadow-sm"
              }`}
            >
              <p className="text-sm">{message.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && onSend()}
            placeholder="필요한 정책이나 상황을 입력하세요..."
            className="flex-1"
          />
          <Button onClick={onSend}>전송</Button>
        </div>
      </div>
    </div>
  );
}
