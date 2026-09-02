import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExecutiveTheme } from '@/constants/theme';

interface BrandLogoProps {
  size?: 'small' | 'medium' | 'large';
  showSubtitle?: boolean;
  align?: 'center' | 'left';
}

export function BrandLogo({
  size = 'medium',
  showSubtitle = true,
  align = 'center',
}: BrandLogoProps) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const iconBoxSize = isSmall ? 40 : isLarge ? 72 : 56;
  const iconSize = isSmall ? 18 : isLarge ? 32 : 24;

  return (
    <View style={[styles.container, align === 'left' && styles.alignLeft]}>
      {/* Brand Icon Emblem */}
      <View
        style={[
          styles.emblemOuter,
          { width: iconBoxSize, height: iconBoxSize, borderRadius: iconBoxSize * 0.28 },
        ]}
      >
        <FontAwesome5 name="tools" size={iconSize} color="#111111" />
      </View>

      {/* Typography */}
      <View style={[styles.textGroup, align === 'left' && styles.textGroupLeft]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isSmall && styles.titleSmall, isLarge && styles.titleLarge]}>
            Fix<Text style={styles.titleHighlight}>Flow</Text>
          </Text>
        </View>
        {showSubtitle && (
          <Text style={[styles.subtitle, isSmall && styles.subtitleSmall]}>
            Smart Facility Maintenance
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  emblemOuter: {
    backgroundColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  textGroup: {
    alignItems: 'center',
  },
  textGroupLeft: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.6,
  },
  titleSmall: {
    fontSize: 18,
  },
  titleLarge: {
    fontSize: 28,
  },
  titleHighlight: {
    color: ExecutiveTheme.colors.brandPrimary,
  },
  proBadge: {
    backgroundColor: '#202020',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F5C400',
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 12.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  subtitleSmall: {
    fontSize: 11,
  },
});
