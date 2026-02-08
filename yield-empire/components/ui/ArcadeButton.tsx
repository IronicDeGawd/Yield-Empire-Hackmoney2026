import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ArcadeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'green' | 'blue' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  bracket?: boolean;
}

export const ArcadeButton = forwardRef<HTMLButtonElement, ArcadeButtonProps>(
  ({ className, variant = 'primary', size = 'md', bracket = true, children, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-4 py-2 text-[8px]',
      md: 'px-6 py-3 text-[10px]',
      lg: 'px-8 py-4 text-xs',
    };

    const variantStyles = {
      primary: bracket ? 'bracket-btn' : 'arcade-btn',
      gold: bracket ? 'bracket-btn bracket-btn-gold' : 'arcade-btn arcade-btn-gold',
      green: 'bracket-btn bracket-btn-green',
      blue: 'bracket-btn bracket-btn-blue',
      secondary: cn(
        'bg-transparent border-2 border-border font-pixel uppercase tracking-wider',
        'hover:border-gold hover:bg-muted/50',
        'transition-all duration-150',
      ),
    };

    return (
      <button
        ref={ref}
        className={cn(variantStyles[variant], sizeStyles[size], 'rounded-sm', className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

ArcadeButton.displayName = 'ArcadeButton';
