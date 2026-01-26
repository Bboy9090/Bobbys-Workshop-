import { ComponentProps } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "flex flex-col rounded-xl transition-all duration-200",
  {
    variants: {
      variant: {
        // Default - Clean modern card
        default:
          "bg-[#14142B] border border-white/[0.08] shadow-lg",
        
        // Glass - Frosted glass effect
        glass:
          "bg-[rgba(26,26,56,0.6)] backdrop-blur-xl border border-white/10",
        
        // Elevated - Slightly raised
        elevated:
          "bg-[#1A1A38] border border-white/[0.08] shadow-xl",
        
        // Phoenix - Fire glow on hover
        phoenix:
          "bg-[#14142B] border border-white/[0.08] hover:border-[rgba(255,77,0,0.3)] hover:shadow-[0_0_30px_rgba(255,77,0,0.15)] group",
        
        // Legendary - Animated gradient border
        legendary:
          "bg-[#1A1A38] relative overflow-hidden before:absolute before:inset-0 before:p-[2px] before:rounded-xl before:bg-gradient-to-r before:from-[#FFD700] before:via-[#FF4D00] before:to-[#7C3AED] before:bg-[length:200%_200%] before:animate-[shimmer_3s_ease-in-out_infinite] before:-z-10 after:absolute after:inset-[2px] after:bg-[#1A1A38] after:rounded-[10px] after:-z-10",
        
        // Cosmic - Purple glow
        cosmic:
          "bg-[#14142B] border border-[rgba(124,58,237,0.2)] hover:border-[rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.15)]",
        
        // Success - Green tinted
        success:
          "bg-[#14142B] border border-[rgba(16,185,129,0.2)] hover:border-[rgba(16,185,129,0.4)]",
        
        // Danger - Red tinted
        danger:
          "bg-[#14142B] border border-[rgba(244,63,94,0.2)] hover:border-[rgba(244,63,94,0.4)]",
        
        // Ghost - Minimal
        ghost:
          "bg-transparent border border-transparent hover:bg-white/[0.02]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface CardProps extends ComponentProps<"div">, VariantProps<typeof cardVariants> {}

function Card({ className, variant, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), "gap-0", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1.5 p-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-lg font-semibold leading-none tracking-tight text-[#F1F5F9]", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-[#64748B]", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "absolute top-4 right-4",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

// Legendary statistics card for dashboards
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
  className,
  ...props 
}: {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  variant?: 'default' | 'phoenix' | 'cosmic' | 'success' | 'legendary'
} & ComponentProps<"div">) {
  const trendColors = {
    up: 'text-[#10B981]',
    down: 'text-[#F43F5E]',
    neutral: 'text-[#64748B]',
  }

  return (
    <Card variant={variant} className={cn("relative overflow-hidden", className)} {...props}>
      {/* Background gradient overlay */}
      {variant === 'phoenix' && (
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top right, rgba(255, 77, 0, 0.5) 0%, transparent 70%)',
          }}
        />
      )}
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#64748B]">{title}</p>
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              variant === 'phoenix' && "bg-[rgba(255,77,0,0.1)] text-[#FF6B2C]",
              variant === 'cosmic' && "bg-[rgba(124,58,237,0.1)] text-[#A78BFA]",
              variant === 'success' && "bg-[rgba(16,185,129,0.1)] text-[#34D399]",
              variant === 'legendary' && "bg-gradient-to-br from-[rgba(255,215,0,0.1)] to-[rgba(255,77,0,0.1)] text-[#FFD700]",
              variant === 'default' && "bg-white/5 text-[#94A3B8]",
            )}>
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-3xl font-bold tracking-tight",
            variant === 'phoenix' && "text-fire",
            variant === 'cosmic' && "text-cosmic", 
            variant === 'legendary' && "text-[#FFD700]",
            (variant === 'default' || variant === 'success') && "text-[#F1F5F9]",
          )}>
            {value}
          </span>
          {trendValue && trend && (
            <span className={cn("text-sm font-medium", trendColors[trend])}>
              {trend === 'up' && '+'}{trendValue}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-[#64748B] mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  StatCard,
  cardVariants,
}
