import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Phoenix Fire - Primary action
        default:
          "bg-gradient-to-r from-[#FF4D00] to-[#FF6B2C] text-white shadow-lg hover:shadow-[0_0_20px_rgba(255,77,0,0.4)] hover:-translate-y-0.5 active:translate-y-0",
        
        // Legendary - Most important actions
        legendary:
          "bg-gradient-to-r from-[#FFD700] via-[#FF4D00] to-[#7C3AED] bg-[length:200%_200%] animate-[shimmer_3s_ease-in-out_infinite] text-white font-bold tracking-wide shadow-[0_0_30px_rgba(255,215,0,0.3)] hover:shadow-[0_0_40px_rgba(255,77,0,0.5)] hover:-translate-y-1",
        
        // Cosmic - Secondary important
        cosmic:
          "bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-white shadow-lg hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:-translate-y-0.5",
        
        // Destructive
        destructive:
          "bg-gradient-to-r from-[#BE123C] to-[#F43F5E] text-white shadow-lg hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:-translate-y-0.5",
        
        // Outline - Subtle
        outline:
          "border border-white/10 bg-transparent hover:bg-white/5 hover:border-white/20 text-[#F1F5F9]",
        
        // Secondary
        secondary:
          "bg-[#1A1A38] text-[#94A3B8] border border-white/5 hover:bg-[#1A1A38]/80 hover:text-[#F1F5F9] hover:border-white/10",
        
        // Ghost
        ghost:
          "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5",
        
        // Link
        link: 
          "text-[#FF6B2C] underline-offset-4 hover:underline hover:text-[#FF4D00]",
        
        // Success
        success:
          "bg-gradient-to-r from-[#047857] to-[#10B981] text-white shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5",
        
        // Glass - Frosted glass effect
        glass:
          "bg-[rgba(26,26,56,0.6)] backdrop-blur-md border border-white/10 text-[#F1F5F9] hover:bg-[rgba(26,26,56,0.8)] hover:border-white/20",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg font-semibold",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
