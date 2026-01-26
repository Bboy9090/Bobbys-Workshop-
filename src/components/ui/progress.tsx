import { ComponentProps } from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full",
  {
    variants: {
      variant: {
        default: "bg-[#0A0A12]",
        phoenix: "bg-[#0A0A12]",
        cosmic: "bg-[#0A0A12]",
        success: "bg-[#0A0A12]",
      },
      size: {
        default: "h-2",
        sm: "h-1",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-300 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-[#FF4D00] to-[#FF6B2C]",
        phoenix: "bg-gradient-to-r from-[#FF4D00] via-[#FFD700] to-[#FF6B2C]",
        cosmic: "bg-gradient-to-r from-[#4C1D95] to-[#7C3AED]",
        success: "bg-gradient-to-r from-[#047857] to-[#10B981]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ProgressProps 
  extends ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  animated?: boolean
}

function Progress({
  className,
  value,
  variant,
  size,
  animated = false,
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(progressVariants({ variant, size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(indicatorVariants({ variant }))}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {/* Shimmer effect for animated variant */}
        {animated && (
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{
              animation: 'progress-shimmer 2s infinite',
            }}
          />
        )}
      </ProgressPrimitive.Indicator>
      
      <style>{`
        @keyframes progress-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants }
