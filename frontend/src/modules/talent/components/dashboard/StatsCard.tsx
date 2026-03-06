'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
  animateIconOnHover?: boolean;
  iconContainerClassName?: string;
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/5 border-primary/20',
  accent: 'bg-accent/5 border-accent/20',
  success: 'bg-success/5 border-success/20',
  warning: 'bg-warning/5 border-warning/20',
  destructive: 'bg-destructive/5 border-destructive/20',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};

import React, { useState } from 'react';

export const StatsCard = ({
  title,
  value,
  icon,
  trend,
  description,
  variant = 'default',
  onClick,
  animateIconOnHover = false,
  iconContainerClassName,
}: StatsCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  // Clone icon to pass animate prop if enabled
  const renderedIcon = (animateIconOnHover && React.isValidElement(icon))
    ? React.cloneElement(icon as React.ReactElement, { animate: isHovered })
    : icon;

  return (
    <Card
      className={cn(
        'border shadow-card transition-all hover:shadow-md group',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:scale-[1.02]'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div initial="rest" whileHover="hover" animate="rest">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-foreground">{value}</h3>
                {trend && (
                  <span
                    className={cn(
                      'flex items-center text-sm font-medium',
                      trend.isPositive ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {trend.isPositive ? (
                      <TrendingUp className="h-4 w-4 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 mr-1" />
                    )}
                    {trend.value}%
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <div className={cn('p-3 rounded-xl', iconStyles[variant], iconContainerClassName)}>
              {renderedIcon}
            </div>
          </div>
        </CardContent>
      </motion.div>
    </Card>
  );
};
