/** @type {import('tailwindcss').Config} */
import { fontFamily } from 'tailwindcss/defaultTheme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Space Jam Colors
        'space-jam-purple': '#6B2C91',
        'space-jam-purple-dark': '#4A1A65',
        'space-jam-purple-light': '#8B4CB8',
        'space-jam-orange': '#FF6B35',
        'space-jam-orange-dark': '#CC5529',
        'space-jam-orange-light': '#FF8C5A',
        'basketball-court': '#FFD700',
        'basketball-lines': '#FFFFFF',
        
        // NYC Playground
        'nyc-concrete': '#2C2C2C',
        'nyc-concrete-dark': '#1A1A1A',
        'nyc-concrete-light': '#3A3A3A',
        'nyc-asphalt': '#1F1F1F',
        'nyc-sidewalk': '#3D3D3D',
        
        // Graffiti Spray
        'spray-neon-cyan': '#00FFFF',
        'spray-neon-pink': '#FF00FF',
        'spray-neon-yellow': '#FFFF00',
        'spray-neon-green': '#00FF00',
        'spray-neon-orange': '#FF6600',
        'spray-neon-purple': '#9932CC',
        
        // Hare Jordan
        'hare-jordan-red': '#CE1141',
        'hare-jordan-black': '#000000',
        'hare-jordan-white': '#FFFFFF',
        'hare-jordan-gold': '#FFD700',
        
        // Trap House
        'trap-basement': '#0D0D0D',
        'trap-walls': '#1A1A1A',
        'trap-ceiling': '#0F0F0F',
        'trap-floor': '#151515',
        'trap-border': '#2A2A2A',
        
        // Legacy Colors (kept for compatibility)
        'midnight-room': '#0F1114',
        'workbench-steel': '#161A1F',
        'basement-concrete': '#1C2127',
        'drawer-hidden': '#12161A',
        
        // Ink
        'ink-primary': '#E8E8E8',
        'ink-muted': '#B0B0B0',
        'ink-inverse': '#0B0D10',
        'ink-graffiti': '#00FFFF',
        'ink-lyric': '#FF3DBB',
        'ink-tape': '#141414',
        'ink-legendary': '#FFFFFF',
        
        // Accents
        'spray-cyan': '#00FFFF',
        'spray-magenta': '#FF3DBB',
        'tape-yellow': '#FFD400',
        'chrome-steel': '#8B949E',
        'crt-green': '#35FF9A',
        
        // States
        'state-locked': '#8B949E',
        'state-ready': '#35FF9A',
        'state-warning': '#FFD400',
        'state-danger': '#E11D48',
        'state-denied': '#B91C1C',
      },
      fontFamily: {
        body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Courier New', 'monospace'],
        tag: ['Comic Sans MS', 'Marker Felt', 'Chalkboard', 'cursive'],
      },
      boxShadow: {
        'neon-buzz': '0 0 12px rgba(45, 212, 255, 0.55)',
        'magenta-buzz': '0 0 14px rgba(255, 61, 187, 0.45)',
        'warning-pulse': '0 0 16px rgba(225, 29, 72, 0.45)',
        'workbench-heavy': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'drawer-inset': 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      borderColor: {
        'hairline': 'rgba(255, 255, 255, 0.10)',
        'panel': 'rgba(255, 255, 255, 0.18)',
        'accent': 'rgba(45, 212, 255, 0.3)',
      },
      transitionTimingFunction: {
        'snap': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'slide': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'shake': 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      transitionDuration: {
        'snap': '150ms',
        'slide-drawer': '300ms',
        'hold-confirm': '2000ms',
      },
      animation: {
        'crt-flicker': 'crt-flicker 0.15s infinite',
        'shake-deny': 'shake-deny 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'hold-progress': 'hold-progress 2s linear',
      },
      keyframes: {
        'crt-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.98' },
        },
        'shake-deny': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'hold-progress': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
}
