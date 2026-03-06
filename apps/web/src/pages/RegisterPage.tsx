import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import {
  confirmPasswordValidationRules,
  emailValidationRules,
  getAuthErrorMessage,
  passwordValidationRules,
} from '../auth/auth-form';
import { registerWithPassword, signInWithGoogle } from '../auth/auth-service';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { clearErrors, formState, handleSubmit, register, setError, watch } =
    useForm<RegisterForm>({
      defaultValues: {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      },
    });
  const password = watch('password');
  const rootError = formState.errors.root?.message?.toString();

  return (
    <div className="layout card">
      <h1>Register</h1>
      <form
        className="grid"
        onSubmit={handleSubmit(async ({ email, name, password }) => {
          clearErrors('root');
          try {
            await registerWithPassword({ email, name, password });
            navigate('/');
          } catch (error) {
            setError('root', {
              message: getAuthErrorMessage(error),
              type: 'server',
            });
          }
        })}
      >
        {rootError ? <p role="alert">{rootError}</p> : null}
        <label htmlFor="register-name">Name</label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          placeholder="Name"
          {...register('name')}
        />
        <label htmlFor="register-email">Email</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          {...register('email', emailValidationRules)}
        />
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Password"
          {...register('password', passwordValidationRules)}
        />
        <label htmlFor="register-confirm-password">Confirm Password</label>
        <input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm Password"
          {...register(
            'confirmPassword',
            confirmPasswordValidationRules(password),
          )}
        />
        <button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={formState.isSubmitting}
          onClick={async () => {
            clearErrors('root');
            try {
              await signInWithGoogle();
              navigate('/');
            } catch (error) {
              setError('root', {
                message: getAuthErrorMessage(error),
                type: 'server',
              });
            }
          }}
        >
          Continue with Google
        </button>
      </form>
      <small>
        Already have an account? <Link to="/login">Sign in</Link>
      </small>
    </div>
  );
}
