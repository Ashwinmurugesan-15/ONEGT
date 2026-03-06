import { motion, useAnimation, Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

type SplitTextProps = {
    text: string;
    className?: string;
    delay?: number;
    duration?: number;
    ease?: string;
    splitType?: 'chars' | 'words';
    from?: { opacity?: number; y?: number; x?: number };
    to?: { opacity?: number; y?: number; x?: number };
    threshold?: number;
    rootMargin?: string;
    textAlign?: 'left' | 'center' | 'right';
    onLetterAnimationComplete?: () => void;
    showCallback?: boolean; // Used to trigger callback logic if true
};

const SplitText = ({
    text,
    className = '',
    delay = 50,
    duration = 0.5,
    ease = 'easeOut',
    splitType = 'chars',
    from = { opacity: 0, y: 20 },
    to = { opacity: 1, y: 0 },
    threshold = 0.1,
    rootMargin = '-50px',
    textAlign = 'left',
    onLetterAnimationComplete,
}: SplitTextProps) => {
    const controls = useAnimation();
    const ref = useRef<HTMLDivElement>(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    // Map GSAP-style ease strings to Framer Motion equivalents
    const getEase = (easeStr: string): any => {
        switch (easeStr) {
            case 'power3.out':
                return [0.215, 0.61, 0.355, 1]; // Cubic bezier for power3.out
            case 'power2.out':
                return 'easeOut';
            case 'linear':
                return 'linear';
            default:
                return 'easeOut';
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated) {
                    controls.start('visible');
                    setHasAnimated(true);
                }
            },
            { threshold, rootMargin }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [controls, threshold, rootMargin, hasAnimated]);

    const words = text.split(' ');

    const containerVariants: Variants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: delay / 1000, // Convert ms to seconds
            },
        },
    };

    const itemVariants: Variants = {
        hidden: from,
        visible: {
            ...to,
            transition: {
                duration,
                ease: getEase(ease),
            },
        },
    };

    return (
        <div className={className} style={{ textAlign }}>
            <motion.div
                ref={ref}
                initial="hidden"
                animate={controls}
                variants={containerVariants}
                onAnimationComplete={() => {
                    if (onLetterAnimationComplete) {
                        onLetterAnimationComplete();
                    }
                }}
                // Use inline-block to allow proper spacing
                style={{ display: 'inline-block' }}
            >
                {words.map((word, wordIndex) => (
                    <span key={wordIndex} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {splitType === 'chars' ? (
                            word.split('').map((char, charIndex) => (
                                <motion.span
                                    key={`${wordIndex}-${charIndex}`}
                                    variants={itemVariants}
                                    style={{ display: 'inline-block' }}
                                >
                                    {char}
                                </motion.span>
                            ))
                        ) : (
                            <motion.span variants={itemVariants} style={{ display: 'inline-block' }}>
                                {word}
                            </motion.span>
                        )}
                        {/* Add space after word unless it's the last one */}
                        {wordIndex < words.length - 1 && (
                            <span style={{ display: 'inline-block' }}>&nbsp;</span>
                        )}
                    </span>
                ))}
            </motion.div>
        </div>
    );
};

export default SplitText;
