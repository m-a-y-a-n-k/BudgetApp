export const COLORS = {
  // Brand Colors
  primary: '#6366f1',
  primaryDark: '#4f46e5',
  primaryLight: '#c7d2fe',
  secondary: '#ec4899',
  secondaryLight: '#fbcfe8',
  
  // Semantic Colors
  success: '#10b981',
  successLight: '#d1fae5',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#06b6d4',
  infoLight: '#cffafe',

  // Neutrals (Light Mode)
  bg: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textLight: '#64748b',
  muted: '#94a3b8',
  border: 'rgba(15, 23, 42, 0.08)',
  
  // Neutrals (Dark Mode - for later use if needed)
  bgDark: '#0f172a',
  surfaceDark: '#1e293b',
  textDark: '#f8fafc',
  
  // Gradients
  gradientPrimary: ['#6366f1', '#a855f7'] as const,
  gradientSecondary: ['#ec4899', '#f43f5e'] as const,
  gradientSuccess: ['#10b981', '#34d399'] as const,
  gradientDanger: ['#ef4444', '#f87171'] as const,
  gradientWarning: ['#f59e0b', '#fbbf24'] as const,
  gradientNeutral: ['#94a3b8', '#cbd5e1'] as const,
  gradientGlass: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)'] as const,
};

export const SIZES = {
  // Spacing
  base: 8,
  small: 12,
  padding: 20,
  large: 24,
  extraLarge: 32,
  
  // Radius
  radiusSmall: 12,
  radiusMedium: 16,
  radiusLarge: 24,
  radiusFull: 999,
  
  // Font Sizes
  h1: 32,
  h2: 24,
  h3: 20,
  body1: 16,
  body2: 14,
  caption: 12,
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  large: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }),
};

export const CATEGORY_ICONS: { [key: string]: string } = {
  'Food': 'restaurant',
  'Groceries': 'cart',
  'Rent': 'home',
  'Utilities': 'flash',
  'Transport': 'car',
  'Shopping': 'bag-handle',
  'Health': 'medical',
  'Education': 'book',
  'Entertainment': 'game-controller',
  'Other': 'options',
  'Salary': 'cash',
  'Fuel': 'speedometer',
  'Dining': 'pizza',
  'Sub': 'tv',
  'Gifts': 'gift',
  'Investment': 'trending-up',
  'Insurance': 'shield-checkmark',
};
