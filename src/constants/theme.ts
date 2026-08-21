import '@/global.css';
import { Platform } from 'react-native';

/**
 * Royal Indigo & Sapphire Luxury Theme Tokens
 * Clean, light, luminous, and executive palette with refined indigo & sapphire accents
 */
export const ExecutiveTheme = {
  colors: {
    // Surfaces & Backgrounds (Luminous & Airy)
    background: '#F8FAFC', // Luminous Pearl Off-White Canvas
    backgroundSubtle: '#F1F5F9', // Crisp Neutral Slate Background
    surface: '#FFFFFF', // Pure Crisp White Card Surface
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    surfaceSubtle: '#EEF2FF', // Soft Indigo Surface Highlight

    // Royal Indigo & Sapphire Brand Accents
    brandPrimary: '#4F46E5', // Luxury Royal Indigo Primary
    brandPrimaryHover: '#4338CA', // Deep Royal Indigo Hover
    brandLight: '#EEF2FF', // Luminous Soft Indigo Mist
    brandLightMuted: '#F5F3FF', // Very Light Lavender Glow
    brandDark: '#4338CA',
    brandDarkHover: '#3730A3',

    // Secondary Accents (Sapphire & Warm Amber)
    accentGold: '#6366F1', // Royal Violet Accent
    accentGoldLight: '#EEF2FF',
    accentGoldBorder: '#C7D2FE',
    accentCopper: '#4F46E5',
    accentCopperLight: '#EDE9FE',

    // Typography (Sophisticated Deep Slate — ZERO harsh pure black)
    textPrimary: '#1E293B', // Rich Deep Slate (High contrast, easy on eyes)
    textSecondary: '#64748B', // Balanced Neutral Slate
    textMuted: '#94A3B8', // Subtitle & Timestamp Silver
    textLight: '#FFFFFF',

    // Borders & Dividers (Frosted & Crisp)
    border: '#E2E8F0', // Soft Crisp Border
    borderSubtle: '#F1F5F9',
    borderDark: '#CBD5E1',

    // Status Badges (Refined Gemstone Pastels)
    statusPendingBg: '#F1F5F9',
    statusPendingText: '#475569',
    statusPendingBorder: '#E2E8F0',

    statusAssignedBg: '#EEF2FF',
    statusAssignedText: '#4F46E5',
    statusAssignedBorder: '#C7D2FE',

    statusProgressBg: '#EFF6FF',
    statusProgressText: '#2563EB',
    statusProgressBorder: '#BFDBFE',

    statusHoldBg: '#FFFBEB',
    statusHoldText: '#D97706',
    statusHoldBorder: '#FDE68A',

    statusCompletedBg: '#ECFDF5',
    statusCompletedText: '#059669',
    statusCompletedBorder: '#A7F3D0',

    statusUrgentBg: '#FFF1F2',
    statusUrgentText: '#E11D48',
    statusUrgentBorder: '#FECDD3',
  },
  shadows: {
    soft: {
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    card: {
      shadowColor: '#1E293B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 3,
    },
    modal: {
      shadowColor: '#1E1B4B',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 10,
    },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  MaxContentWidth: 1120,
  maxContentWidth: 1120,
};

/**
 * Format monetary amount into Indian Rupee (₹) string with standard Indian number grouping
 * e.g. 1000 -> ₹1,000 | 150000 -> ₹1,50,000
 */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  } catch (e) {
    return `₹${num.toLocaleString('en-IN')}`;
  }
}

export const Colors = {
  light: {
    text: '#1E293B',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#EEF2FF',
    textSecondary: '#64748B',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#312E81',
    textSecondary: '#94A3B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Fonts = {
  regular: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }),
  mono: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
};

export const BottomTabInset = Platform.select({ ios: 60, android: 75 }) ?? 0;
export const MaxContentWidth = 1120;
