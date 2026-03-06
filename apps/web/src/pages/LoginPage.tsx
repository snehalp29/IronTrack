import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import {
  emailValidationRules,
  getAuthErrorMessage,
  passwordValidationRules,
} from '../auth/auth-form';
import { loginWithPassword, signInWithGoogle } from '../auth/auth-service';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { clearErrors, formState, handleSubmit, register, setError } =
    useForm<LoginForm>({
      defaultValues: { email: '', password: '' },
    });
  const rootError = formState.errors.root?.message?.toString();

  return (
    <div className="layout card">
      <h1>Login</h1>
      <form
        className="grid"
        onSubmit={handleSubmit(async ({ email, password }) => {
          clearErrors('root');
          try {
            await loginWithPassword({ email, password });
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
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          {...register('email', emailValidationRules)}
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          {...register('password', passwordValidationRules)}
        />
        <button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Signing In...' : 'Sign In'}
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
        New here? <Link to="/register">Create account</Link>
      </small>
    </div>
  );
}
