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
        <input placeholder="Name" {...register('name')} />
        <input placeholder="Email" {...register('email')} />
        <input
          type="password"
          placeholder="Password"
          {...register('password')}
        />
        <input
          type="password"
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
