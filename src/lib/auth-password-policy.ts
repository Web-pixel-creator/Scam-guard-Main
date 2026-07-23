export const SIGNUP_PASSWORD_MIN_LENGTH = 12;

export const SIGNUP_PASSWORD_PATTERN = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}";

export const SIGNUP_PASSWORD_REQUIREMENTS =
  "Минимум 12 символов: строчная и заглавная латинские буквы, цифра и специальный символ.";
