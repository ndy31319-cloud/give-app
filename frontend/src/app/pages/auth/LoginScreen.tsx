import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Heart } from "lucide-react";
import { validateEmail, validateRequired } from "@/app/utils/validation";
import { useApp } from "@/app/context/AppContext";
import { authAPI, saveUserId } from "@/app/services/api";

export function LoginScreen() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; submit?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (field: "email" | "password", value: string) => {
    if (field === "email") {
      if (!validateRequired(value)) return "이메일을 입력해주세요";
      return validateEmail(value) ? "" : "올바른 이메일 형식이 아닙니다";
    }

    return validateRequired(value) ? "" : "비밀번호를 입력해주세요";
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const value = field === "email" ? email : password;
    const error = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleChange = (field: "email" | "password", value: string) => {
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);

    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailError = validateField("email", email);
    const passwordError = validateField("password", password);

    setErrors({
      email: emailError,
      password: passwordError,
      submit: "",
    });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);

    const result = await authAPI.login({ email, password });

    setIsSubmitting(false);

    if (result.error || !result.data) {
      setErrors((prev) => ({
        ...prev,
        submit: result.error || "로그인에 실패했습니다.",
      }));
      return;
    }

    setUser(result.data.user);
    saveUserId(result.data.user.id);
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Heart className="w-16 h-16 text-blue-600 fill-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">나눔이음</h1>
          <p className="text-gray-600">필요한 나눔, 연결되는 일상</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              className={`w-full ${errors.email && touched.email ? "border-red-500" : ""}`}
            />
            {errors.email && touched.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              className={`w-full ${errors.password && touched.password ? "border-red-500" : ""}`}
            />
            {errors.password && touched.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>
          {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <button className="text-sm text-gray-600 hover:text-gray-800">비밀번호 찾기</button>
          <div className="text-sm text-gray-600">
            계정이 없으신가요?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-blue-600 font-medium hover:text-blue-700"
            >
              회원가입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
