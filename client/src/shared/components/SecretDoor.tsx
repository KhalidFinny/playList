import { useNavigate } from '@tanstack/react-router';
import logoUrl from '@/assets/logo.svg';

export function SecretDoor({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  const navigate = useNavigate();

  const handleSecretEntry = () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      navigate({ to: '/admin' });
    } else {
      navigate({ to: '/login' });
    }
  };

  const sizeClasses = {
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
    xl: 'h-14 w-14'
  };

  return (
    <div 
      onDoubleClick={handleSecretEntry}
      className="cursor-default select-none group relative opacity-40 hover:opacity-100 transition-opacity"
    >
      <img src={logoUrl} alt="" className={`${sizeClasses[size]} grayscale hover:grayscale-0 transition-all active:scale-90`} />
    </div>
  );
}
