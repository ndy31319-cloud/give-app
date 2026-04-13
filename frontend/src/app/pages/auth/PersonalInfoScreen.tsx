import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/app/context/AppContext";
import { BirthdateSelectFields } from "./components/BirthdateSelectFields";
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validatePhone,
  validateRequired,
} from "@/app/utils/validation";

export function PersonalInfoScreen() {
  const navigate = useNavigate();
  const { setSignupData } = useApp();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthdate: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (field: string, value: string) => {
    switch (field) {
      case "name":
        return validateRequired(value) ? "" : "이름을 입력해주세요";
      case "email":
        if (!validateRequired(value)) return "이메일을 입력해주세요";
        return validateEmail(value) ? "" : "올바른 이메일 형식이 아닙니다";
      case "phone":
        if (!validateRequired(value)) return "전화번호를 입력해주세요";
        return validatePhone(value) ? "" : "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)";
      case "birthdate":
        return validateRequired(value) ? "" : "생년월일을 입력해주세요";
      case "password":
        if (!validateRequired(value)) return "비밀번호를 입력해주세요";
        return validatePassword(value)
          ? ""
          : "비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다";
      case "confirmPassword":
        return validatePasswordMatch(formData.password, value)
          ? ""
          : "비밀번호가 일치하지 않습니다";
      default:
        return "";
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    const error = validateField(field, formData[field as keyof typeof formData]);
    setErrors({ ...errors, [field]: error });
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors({ ...errors, [field]: error });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 모든 필드 유효성 검사
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((field) => {
      const error = validateField(field, formData[field as keyof typeof formData]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    setTouched(
      Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {})
    );

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // 전역 상태에 저장 (일반 사용자)
    setSignupData({
      isVulnerable: false,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      birthdate: formData.birthdate,
      password: formData.password,
    });

    navigate("/location-setting");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="ml-4 text-lg font-semibold">개인정보 입력</h1>
      </div>

      <div className="px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">이름 *</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="이름을 입력하세요"
              className={errors.name && touched.name ? "border-red-500" : ""}
            />
            {errors.name && touched.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">이메일 *</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              placeholder="example@email.com"
              className={errors.email && touched.email ? "border-red-500" : ""}
            />
            {errors.email && touched.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">전화번호 *</label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              onBlur={() => handleBlur("phone")}
              placeholder="010-1234-5678"
              className={errors.phone && touched.phone ? "border-red-500" : ""}
            />
            {errors.phone && touched.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">생년월일 *</label>
            <BirthdateSelectFields
              value={formData.birthdate}
              onChange={(value) => handleChange("birthdate", value)}
              onBlur={() => handleBlur("birthdate")}
              hasError={!!(errors.birthdate && touched.birthdate)}
            />
            {errors.birthdate && touched.birthdate && (
              <p className="text-red-500 text-xs mt-1">{errors.birthdate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">비밀번호 *</label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              onBlur={() => handleBlur("password")}
              placeholder="8자 이상, 영문+숫자"
              className={errors.password && touched.password ? "border-red-500" : ""}
            />
            {errors.password && touched.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">비밀번호 확인 *</label>
            <Input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              onBlur={() => handleBlur("confirmPassword")}
              placeholder="비밀번호를 다시 입력하세요"
              className={
                errors.confirmPassword && touched.confirmPassword ? "border-red-500" : ""
              }
            />
            {errors.confirmPassword && touched.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            다음
          </Button>
        </form>
      </div>
    </div>
  );
}
