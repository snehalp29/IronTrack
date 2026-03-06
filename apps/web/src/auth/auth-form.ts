const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

export const emailValidationRules = {
  required: 'Email is required',
  pattern: {
    value: EMAIL_PATTERN,
    message: 'Enter a valid email address',
  },
};

export const passwordValidationRules = {
  required: 'Password is required',
  minLength: {
    value: PASSWORD_MIN_LENGTH,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  },
};

export function confirmPasswordValidationRules(password: string) {
  return {
    required: 'Confirm your password',
    validate: (value: string) => value === password || 'Passwords do not match',
  };
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
