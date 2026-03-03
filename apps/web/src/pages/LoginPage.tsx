import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });

  return (
    <div className="layout card">
      <h1>Login</h1>
      <form
        className="grid"
        onSubmit={handleSubmit(() => {
          navigate('/');
        })}
      >
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          {...register('email')}
        />
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          {...register('password')}
        />
        <button type="submit">Sign In</button>
        <button type="button" className="secondary">
          Continue with Google
        </button>
      </form>
      <small>
        New here? <Link to="/register">Create account</Link>
      </small>
    </div>
  );
}
