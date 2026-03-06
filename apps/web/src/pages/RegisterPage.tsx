import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { registerWithPassword, signInWithGoogle } from '../auth/auth-service';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch } = useForm<RegisterForm>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });
  const password = watch('password');

  return (
    <div className="layout card">
      <h1>Register</h1>
      <form
        className="grid"
        onSubmit={handleSubmit(async ({ email, name, password }) => {
          await registerWithPassword({ email, name, password });
          navigate('/');
        })}
      >
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Name"
          {...register('name')}
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="Email"
          {...register('email')}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Password"
          {...register('password')}
        />
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm Password"
          {...register('confirmPassword', {
            validate: (value) => value === password || 'Passwords must match',
          })}
        />
        <button type="submit">Create Account</button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            await signInWithGoogle();
            navigate('/');
          }}
        >
          Sign Up with Google
        </button>
      </form>
      <small>
        Already have an account? <Link to="/login">Sign in</Link>
      </small>
    </div>
  );
}
