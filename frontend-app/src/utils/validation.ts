export const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePhone = (phone: string) =>
  /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(phone.replace(/-/g, ''));

export const validateLoginIdentifier = (value: string) => {
  const trimmed = value.trim();
  return validateEmail(trimmed) || validatePhone(trimmed);
};

export const validatePassword = (password: string) =>
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/.test(password);

export const validateRequired = (value: string) => value.trim().length > 0;

export const validatePasswordMatch = (password: string, confirm: string) =>
  password.length > 0 && password === confirm;
