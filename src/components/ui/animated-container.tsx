/**
 * Animated Container Components
 * 
 * GOD MODE: Beautiful, smooth animations for all UI elements.
 * Legendary transitions and micro-interactions.
 */

import React, { ReactNode } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// Fade in animation
export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide up animation
export function SlideUp({
  children,
  delay = 0,
  duration = 0.4,
  distance = 20,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: distance }}
      transition={{ 
        delay, 
        duration,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide in from left
export function SlideInLeft({
  children,
  delay = 0,
  duration = 0.4,
  distance = 30,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -distance }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -distance }}
      transition={{ delay, duration, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Scale in animation
export function ScaleIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay, duration, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered children animation
export function StaggerChildren({
  children,
  staggerDelay = 0.1,
  className,
}: {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger child
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// Pulse animation for attention
export function Pulse({
  children,
  className,
  intensity = 1.05,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  return (
    <motion.div
      animate={{
        scale: [1, intensity, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Glow animation
export function Glow({
  children,
  color = "cyan",
  className,
}: {
  children: ReactNode;
  color?: "cyan" | "magenta" | "yellow" | "green" | "red";
  className?: string;
}) {
  const glowColors = {
    cyan: "shadow-[0_0_15px_rgba(45,212,255,0.5)]",
    magenta: "shadow-[0_0_15px_rgba(255,61,187,0.5)]",
    yellow: "shadow-[0_0_15px_rgba(255,212,0,0.5)]",
    green: "shadow-[0_0_15px_rgba(53,255,154,0.5)]",
    red: "shadow-[0_0_15px_rgba(225,29,72,0.5)]",
  };

  return (
    <motion.div
      animate={{
        boxShadow: [
          "0 0 0px rgba(0,0,0,0)",
          glowColors[color].replace("shadow-[", "").replace("]", ""),
          "0 0 0px rgba(0,0,0,0)",
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={cn("rounded-lg", className)}
    >
      {children}
    </motion.div>
  );
}

// Floating animation
export function Float({
  children,
  amplitude = 5,
  duration = 3,
  className,
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      animate={{
        y: [-amplitude, amplitude, -amplitude],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Shake animation (for errors/denials)
export function Shake({
  children,
  trigger,
  className,
}: {
  children: ReactNode;
  trigger?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      animate={trigger ? {
        x: [-4, 4, -4, 4, -4, 4, 0],
      } : {}}
      transition={{
        duration: 0.5,
        ease: [0.36, 0.07, 0.19, 0.97],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Reveal on scroll
export function RevealOnScroll({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Interactive card with hover effects
export function InteractiveCard({
  children,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      whileHover={disabled ? {} : { 
        scale: 1.02, 
        y: -2,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "cursor-pointer transition-colors",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Loading skeleton with shimmer
export function LoadingSkeleton({
  className,
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <motion.div
      animate={{
        backgroundPosition: ["200% 0", "-200% 0"],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        width,
        height,
        background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)",
        backgroundSize: "200% 100%",
      }}
      className={cn("rounded", className)}
    />
  );
}

// Counter animation
export function AnimatedCounter({
  value,
  duration = 1,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      <motion.span
        key={value}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.span>
    </motion.span>
  );
}

// Status indicator with pulse
export function StatusIndicator({
  status,
  size = "md",
  className,
}: {
  status: "online" | "offline" | "warning" | "error" | "loading";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    loading: "bg-blue-500",
  };

  const pulseColors = {
    online: "bg-green-400",
    offline: "bg-gray-400",
    warning: "bg-yellow-400",
    error: "bg-red-400",
    loading: "bg-blue-400",
  };

  return (
    <span className={cn("relative inline-flex", className)}>
      <span className={cn(
        "rounded-full",
        sizeClasses[size],
        statusColors[status]
      )} />
      {status !== "offline" && (
        <motion.span
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.7, 0, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={cn(
            "absolute inset-0 rounded-full",
            pulseColors[status]
          )}
        />
      )}
    </span>
  );
}
