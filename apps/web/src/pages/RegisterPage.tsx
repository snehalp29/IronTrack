import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, handleSubmit } = useForm<RegisterForm>();

  return (
    <div className="layout card">
      <h1>Register</h1>
      <form
        className="grid"
        onSubmit={handleSubmit(() => {
          navigate('/');
        })}
      >
        <label htmlFor="register-name">Name</label>
        <input
          id="register-name"
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
          {...register('email')}
        />
        <label htmlFor="register-password">Password</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Password"
          {...register('password')}
        />
        <label htmlFor="register-confirm-password">Confirm Password</label>
        <input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm Password"
          {...register('confirmPassword')}
        />
        <button type="submit">Create Account</button>
        <button type="button" className="secondary">
          Sign Up with Google
        </button>
      </form>
      <small>
        Already have an account? <Link to="/login">Sign in</Link>
      </small>
    </div>
  );
}
