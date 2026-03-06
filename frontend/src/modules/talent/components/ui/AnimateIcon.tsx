import React from 'react';
import { cn } from '@/lib/utils';

interface AnimateIconProps {
    children: React.ReactNode;
    animateOnHover?: boolean;
    animation?: 'ring' | 'spin' | 'bounce';
    className?: string;
}

export const AnimateIcon = ({
    children,
    animateOnHover = false,
    animation = 'ring',
    className
}: AnimateIconProps) => {
    return (
        <div className={cn(
            "inline-flex items-center justify-center",
            animateOnHover && (
                animation === 'ring' ? "hover-ring" :
                    animation === 'spin' ? "hover-spin" : "hover-bounce"
            ),
            className
        )}>
            {children}
        </div>
    );
};
