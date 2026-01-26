import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-all duration-200",
  {
    variants: {
      variant: {
        // Phoenix - Fire gradient
        default:
          "border-transparent bg-gradient-to-r from-[#FF4D00] to-[#FF6B2C] text-white shadow-sm",
        
        // Legendary - Animated rainbow
        legendary:
          "border-transparent bg-gradient-to-r from-[#FFD700] via-[#FF4D00] to-[#7C3AED] bg-[length:200%_200%] animate-[shimmer_3s_ease-in-out_infinite] text-white shadow-[0_0_10px_rgba(255,215,0,0.3)]",
        
        // Cosmic - Purple
        cosmic:
          "border-transparent bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-white shadow-sm",
        
        // Cyber - Cyan
        cyber:
          "border-transparent bg-gradient-to-r from-[#0891B2] to-[#06B6D4] text-white shadow-sm",
        
        // Success - Green
        success:
          "border-transparent bg-gradient-to-r from-[#047857] to-[#10B981] text-white shadow-sm",
        
        // Warning - Amber
        warning:
          "border-transparent bg-gradient-to-r from-[#B45309] to-[#F59E0B] text-white shadow-sm",
        
        // Destructive - Red
        destructive:
          "border-transparent bg-gradient-to-r from-[#BE123C] to-[#F43F5E] text-white shadow-sm",
        
        // Secondary - Muted
        secondary:
          "border-transparent bg-[#1A1A38] text-[#94A3B8]",
        
        // Outline - Bordered
        outline:
          "border-white/10 bg-transparent text-[#94A3B8] hover:bg-white/5 hover:text-[#F1F5F9]",
        
        // Ghost - Minimal
        ghost:
          "border-transparent bg-white/5 text-[#94A3B8]",
        
        // Online status
        online:
          "border-transparent bg-[#10B981]/20 text-[#34D399]",
        
        // Offline status
        offline:
          "border-transparent bg-[#64748B]/20 text-[#64748B]",
        
        // Busy status
        busy:
          "border-transparent bg-[#F59E0B]/20 text-[#FCD34D]",
        
        // Error status  
        error:
          "border-transparent bg-[#F43F5E]/20 text-[#FB7185]",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
