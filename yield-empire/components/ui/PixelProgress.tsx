import { cn } from '@/lib/utils';

interface PixelProgressProps {
  value: number;
  max?: number;
  className?: string;
  variant?: 'gold' | 'green' | 'blue' | 'purple';
  showLabel?: boolean;
  label?: string;
}

export const PixelProgress = ({
  value,
  max = 100,
  className,
  variant = 'gold',
  showLabel = true,
  label,
}: PixelProgressProps) => {
  const percentage = Math.min((value / max) * 100, 100);

  const fillColors = {
    gold: 'bg-gold',
    green: 'bg-neon-green',
    blue: 'bg-neon-blue',
    purple: 'bg-primary',
  };

  return (
    <div className={cn('space-y-1', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between font-pixel text-[8px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="pixel-progress rounded-sm">
        <div
          className={cn('pixel-progress-fill transition-all duration-300', fillColors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface SegmentedProgressProps {
  value: number;
  segments?: number;
  className?: string;
  variant?: 'gold' | 'green' | 'purple';
}

export const SegmentedProgress = ({
  value,
  segments = 10,
  className,
  variant = 'gold',
}: SegmentedProgressProps) => {
  const filledSegments = Math.round((value / 100) * segments);

  const fillColors = {
    gold: 'bg-gold',
    green: 'bg-neon-green',
    purple: 'bg-primary',
  };

  return (
    <div className={cn('flex gap-1', className)}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-3 flex-1 border border-border rounded-sm transition-all duration-200',
            i < filledSegments ? fillColors[variant] : 'bg-muted',
          )}
        />
      ))}
    </div>
  );
};
