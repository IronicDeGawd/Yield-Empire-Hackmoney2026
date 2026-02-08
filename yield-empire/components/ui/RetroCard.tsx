import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface RetroCardProps {
  children: ReactNode;
  className?: string;
  borderColor?: 'gold' | 'green' | 'blue' | 'purple' | 'default';
  hover?: boolean;
}

export const RetroCard = ({
  children,
  className,
  borderColor = 'default',
  hover = true,
}: RetroCardProps) => {
  const borderStyles = {
    gold: 'retro-card-gold',
    green: 'retro-card-green',
    blue: 'retro-card-blue',
    purple: 'retro-card-purple',
    default: '',
  };

  return (
    <div
      className={cn(
        'retro-card rounded-sm p-6 transition-all duration-200',
        borderStyles[borderColor],
        hover && 'hover:border-gold/60',
        className,
      )}
    >
      {children}
    </div>
  );
};

interface RetroCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export const RetroCardHeader = ({ children, className }: RetroCardHeaderProps) => (
  <div className={cn('mb-4 border-b border-border pb-3', className)}>{children}</div>
);

interface RetroCardTitleProps {
  children: ReactNode;
  className?: string;
}

export const RetroCardTitle = ({ children, className }: RetroCardTitleProps) => (
  <h3 className={cn('font-pixel text-xs text-foreground flex items-center gap-2', className)}>
    {children}
  </h3>
);

interface RetroCardContentProps {
  children: ReactNode;
  className?: string;
}

export const RetroCardContent = ({ children, className }: RetroCardContentProps) => (
  <div className={cn('font-retro text-lg', className)}>{children}</div>
);
