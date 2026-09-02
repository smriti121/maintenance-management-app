import '@/global.css';
import { Platform } from 'react-native';

/**
 * FixFlow Professional Dark / Black / Charcoal Executive Theme Tokens
 * Enterprise high-contrast dark aesthetic with Deep Obsidian, Dark Slate, Charcoal, and Tech Cobalt Accents
 */
export const ExecutiveTheme = {
  colors: {
    // Surfaces & Backgrounds (Black, Dark Charcoal & Dark Grey)
    background: '#111111', // Main App Canvas: Deep Industrial Black
    backgroundSubtle: '#202020', // Secondary surface / inputs / backdrop: Dark charcoal
    surface: '#202020', // Card & App Bar Surface: Dark charcoal
    surfaceElevated: '#2B2B2B', // Elevated elements & modal containers: Dark grey
    surfaceMuted: '#2B2B2B', // Muted container background
    surfaceSubtle: '#2B2B2B', // Subtle accent pill background

    // Yellow Brand Accents
    brandPrimary: '#F5C400', // Yellow accent
    brandPrimaryLight: '#F5C400', // Yellow accent
    brandPrimaryHover: '#D9A900', // Dark yellow / gold for pressed states
    brandLight: '#2B2B2B', // Dark grey container
    brandLightMuted: 'rgba(245, 196, 0, 0.12)', // Subtle yellow glow
    brandDark: '#D9A900',
    brandDarkHover: '#B88E00',

    // Discipline & Secondary Accents (Industrial Grey + Yellow Palette)
    accentIndigo: '#F5C400', // Electrical (Yellow)
    accentIndigoLight: '#2B2B2B',
    accentIndigoBorder: '#F5C400',
    accentRose: '#E5E5E5', // Plumbing / Fixtures (Light grey)
    accentRoseLight: '#2B2B2B',
    accentRoseBorder: '#4A4A4A',
    accentAmber: '#F5C400', // Priority (Yellow)
    accentAmberLight: '#2B2B2B',
    accentAmberBorder: '#D9A900',
    accentEmerald: '#F5C400', // Resolved / Success (Yellow accent)
    accentEmeraldLight: '#2B2B2B',
    accentEmeraldBorder: '#4A4A4A',
    accentCoral: '#F5C400', // Urgent / Critical (Yellow)
    accentCoralLight: '#2B2B2B',
    accentCoralBorder: '#F5C400',

    // Typography (High Contrast Clean White & Greys)
    textPrimary: '#FFFFFF', // Bright Crisp White Headings
    textSecondary: '#E5E5E5', // Light Grey Subtext
    textMuted: '#888888', // Timestamps & Placeholder Grey
    textLight: '#FFFFFF',

    // Borders & Dividers (Dark & Medium Grey Outlines)
    border: '#2B2B2B', // Card Borders: Dark grey
    borderSubtle: '#202020', // Subtle Dividers
    borderDark: '#4A4A4A', // Medium grey outline

    // Status Badges (Grey + Yellow System)
    statusPendingBg: '#2B2B2B',
    statusPendingText: '#E5E5E5',
    statusPendingBorder: '#4A4A4A',

    statusAssignedBg: '#2B2B2B',
    statusAssignedText: '#F5C400',
    statusAssignedBorder: '#F5C400',

    statusProgressBg: '#202020',
    statusProgressText: '#F5C400',
    statusProgressBorder: '#F5C400',

    statusHoldBg: '#2B2B2B',
    statusHoldText: '#E5E5E5',
    statusHoldBorder: '#4A4A4A',

    statusCompletedBg: '#202020',
    statusCompletedText: '#FFFFFF',
    statusCompletedBorder: '#4A4A4A',

    statusUrgentBg: '#202020',
    statusUrgentText: '#F5C400',
    statusUrgentBorder: '#F5C400',
  },
  shadows: {
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 3,
    },
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 3,
    },
    modal: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
      elevation: 12,
    },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
    full: 9999,
  },
  layout: {
    screenPadding: 16,
    touchTarget: 46,
    inputHeight: 46,
    buttonHeight: 48,
    headerHeight: 54,
    bottomNavHeight: 58,
  },
  MaxContentWidth: 540,
  maxContentWidth: 540,
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
    text: '#FFFFFF',
    background: '#111111',
    backgroundElement: '#202020',
    backgroundSelected: '#2B2B2B',
    textSecondary: '#E5E5E5',
  },
  dark: {
    text: '#FFFFFF',
    background: '#111111',
    backgroundElement: '#202020',
    backgroundSelected: '#2B2B2B',
    textSecondary: '#E5E5E5',
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
