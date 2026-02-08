'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StatCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  className?: string;
  animate?: boolean;
  icon?: React.ReactNode;
}

export const StatCounter = ({
  value,
  label,
  prefix = '',
  suffix = '',
  className,
  animate = true,
  icon,
}: StatCounterProps) => {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    const duration = 1200;
    const steps = 25;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, animate]);

  return (
    <div className={cn('stat-box rounded-sm', className)}>
      {icon && <div className="mb-2 text-gold">{icon}</div>}
      <div className="font-pixel text-lg md:text-xl text-gold">
        {prefix}
        {displayValue.toLocaleString()}
        {suffix}
      </div>
      <div className="font-pixel text-[8px] text-muted-foreground mt-1 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
};

interface CoinCounterProps {
  value: number;
  className?: string;
}

export const CoinCounter = ({ value, className }: CoinCounterProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-5 h-5 rounded-full bg-gold border border-gold/50" />
      <span className="font-pixel text-gold text-sm">{value.toLocaleString()}</span>
    </div>
  );
};
