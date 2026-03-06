import React from 'react';
import { motion, Variants, SVGMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// We omit props that we want to control or that might conflict
interface ClipboardCheckProps extends Omit<SVGMotionProps<SVGSVGElement>, 'variants' | 'initial' | 'whileHover' | 'animate'> {
    animateOnHover?: boolean;
    animation?: 'ring' | 'spin' | 'bounce' | 'blink';
}

export const ClipboardCheck = ({
    animateOnHover = false,
    animation = 'blink',
    className,
    ...props
}: ClipboardCheckProps) => {
    const animations: Record<string, Variants> = {
        ring: {
            rest: { rotate: 0 },
            hover: {
                rotate: [0, 10, -10, 5, -5, 2, -2, 0],
                transition: {
                    duration: 0.5,
                    ease: "easeInOut",
                },
            },
        },
        spin: {
            rest: { rotate: 0 },
            hover: {
                rotate: 360,
                transition: {
                    duration: 0.6,
                    ease: "linear",
                    repeat: Infinity,
                },
            },
        },
        bounce: {
            rest: { y: 0, scale: 1 },
            hover: {
                y: [-2, -4, -2, 0],
                scale: [1, 1.05, 1.05, 1],
                transition: {
                    duration: 0.6,
                    ease: "easeInOut",
                    repeat: Infinity,
                },
            },
        },
        blink: {
            rest: { opacity: 1, scale: 1 },
            hover: {
                opacity: [1, 0.3, 1, 0.3, 1],
                scale: [1, 0.95, 1, 0.95, 1],
                transition: {
                    duration: 1,
                    ease: "easeInOut",
                    repeat: Infinity,
                },
            },
        },
    };

    const selectedAnimation = animations[animation];

    return (
        <motion.svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('lucide lucide-clipboard-check', className)}
            initial="rest"
            whileHover={animateOnHover ? 'hover' : undefined}
            variants={selectedAnimation}
            {...props}
        >
            <motion.rect
                width="8"
                height="4"
                x="8"
                y="2"
                rx="1"
                ry="1"
                variants={{
                    rest: { scale: 1 },
                    hover: {
                        scale: [1, 1.1, 1],
                        transition: { duration: 0.3, delay: 0.1 },
                    },
                }}
            />
            <motion.path
                d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
                variants={{
                    rest: { pathLength: 1, opacity: 1 },
                    hover: {
                        pathLength: [0, 1],
                        opacity: [0, 1],
                        transition: { duration: 0.4, delay: 0.2 },
                    },
                }}
            />
            <motion.path
                d="m9 12 2 2 4-4"
                variants={{
                    rest: { pathLength: 1, opacity: 1 },
                    hover: {
                        pathLength: [0, 1],
                        opacity: [0.5, 1],
                        transition: { duration: 0.4, delay: 0.4 },
                    },
                }}
            />
        </motion.svg>
    );
};
