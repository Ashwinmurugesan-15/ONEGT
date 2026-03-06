'use client';

import React from 'react';
import { motion, Variants, SVGMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface UsersProps extends Omit<SVGMotionProps<SVGSVGElement>, 'variants' | 'initial' | 'whileHover' | 'animate'> {
    animateOnHover?: boolean;
    animate?: boolean;
    animation?: 'ring' | 'spin' | 'bounce' | 'blink';
}

export const Users = ({
    animateOnHover = false,
    animate,
    animation = 'bounce',
    className,
    ...props
}: UsersProps) => {
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
            rest: { y: 0 },
            hover: {
                y: [-2, -4, -2, 0],
                transition: {
                    duration: 0.6,
                    ease: "easeInOut",
                    repeat: Infinity,
                },
            },
        },
        blink: {
            rest: { opacity: 1 },
            hover: {
                opacity: [1, 0.4, 1, 0.4, 1],
                transition: {
                    duration: 1.5,
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
            className={cn('lucide lucide-users', className)}
            initial="rest"
            animate={animate !== undefined ? (animate ? "hover" : "rest") : undefined}
            whileHover={animate === undefined && animateOnHover ? "hover" : undefined}
            variants={selectedAnimation}
            {...props}
        >
            <motion.path
                d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                variants={{
                    rest: { x: 0 },
                    hover: { x: [-1, 1, -1, 1, 0], transition: { duration: 0.5 } }
                }}
            />
            <motion.circle
                cx="9"
                cy="7"
                r="4"
                variants={{
                    rest: { scale: 1 },
                    hover: { scale: [1, 1.1, 1], transition: { duration: 0.5 } }
                }}
            />
            <motion.path
                d="M22 21v-2a4 4 0 0 0-3-3.87"
                variants={{
                    rest: { opacity: 1 },
                    hover: { opacity: [1, 0.5, 1], transition: { duration: 0.5, delay: 0.1 } }
                }}
            />
            <motion.path
                d="M16 3.13a4 4 0 0 1 0 7.75"
                variants={{
                    rest: { opacity: 1 },
                    hover: { opacity: [1, 0.5, 1], transition: { duration: 0.5, delay: 0.2 } }
                }}
            />
        </motion.svg>
    );
};
