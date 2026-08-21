import { Ionicons } from '@expo/vector-icons';
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
  const iconSize = isSmall ? 20 : isLarge ? 34 : 26;

  return (
    <View style={[styles.container, align === 'left' && styles.alignLeft]}>
      {/* Premium Multi-Layered Geometric Emblem */}
      <View
        style={[
          styles.emblemOuter,
          { width: iconBoxSize, height: iconBoxSize, borderRadius: iconBoxSize * 0.32 },
        ]}
      >
        <View
          style={[
            styles.emblemInner,
            { width: iconBoxSize - 6, height: iconBoxSize - 6, borderRadius: (iconBoxSize - 6) * 0.3 },
          ]}
        >
          <View style={styles.iconLayer}>
            <Ionicons name="shield-checkmark" size={iconSize} color="#FFFFFF" />
          </View>
          <View style={styles.sparkleAccent}>
            <Ionicons name="sparkles" size={iconSize * 0.45} color="#A5B4FC" />
          </View>
        </View>
      </View>

      {/* Typography */}
      <View style={[styles.textGroup, align === 'left' && styles.textGroupLeft]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isSmall && styles.titleSmall, isLarge && styles.titleLarge]}>
            Fix<Text style={styles.titleHighlight}>Flow</Text>
          </Text>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>ENTERPRISE</Text>
          </View>
        </View>
        {showSubtitle && (
          <Text style={[styles.subtitle, isSmall && styles.subtitleSmall]}>
            Smart Facility Maintenance Platform
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
    backgroundColor: '#3730A3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  emblemInner: {
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  iconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleAccent: {
    position: 'absolute',
    top: 3,
    right: 4,
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
    color: '#4F46E5',
  },
  proBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4F46E5',
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
