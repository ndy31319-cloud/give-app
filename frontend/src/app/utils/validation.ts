// 입력 폼 유효성 검사 유틸리티

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
  return phoneRegex.test(phone.replace(/-/g, ""));
};

export const validatePassword = (password: string): boolean => {
  // 최소 8자, 영문, 숫자 포함
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  return passwordRegex.test(password);
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validatePasswordMatch = (password: string, confirm: string): boolean => {
  return password === confirm && password.length > 0;
};

export interface ValidationError {
  field: string;
  message: string;
}

export const getValidationErrors = (
  data: Record<string, any>,
  rules: Record<string, (value: any) => { isValid: boolean; message: string }>
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  Object.keys(rules).forEach((field) => {
    const result = rules[field](data[field]);
    if (!result.isValid) {
      errors.push({ field, message: result.message });
    }
  });
  
  return errors;
};
