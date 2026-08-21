import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';

interface ExecutiveHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  fallbackRoute?: string;
  rightElement?: React.ReactNode;
}

export function ExecutiveHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  fallbackRoute = '/user/dashboard',
  rightElement,
}: ExecutiveHeaderProps) {
  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  }

  // Handle Android hardware back press
  useEffect(() => {
    if (!showBack) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, [showBack]);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.innerRow}>
        {showBack ? (
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <View style={styles.backIconCircle}>
              <Ionicons name="chevron-back" size={16} color={ExecutiveTheme.colors.brandPrimary} />
            </View>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightSlot}>
          {rightElement || <View style={styles.rightPlaceholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.border,
    paddingTop: Platform.OS === 'ios' ? 8 : 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 70,
    height: 38,
    gap: 4,
  },
  backIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '600',
    color: ExecutiveTheme.colors.brandPrimary,
    lineHeight: 22,
    marginLeft: -1,
  },
  backLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  backPlaceholder: {
    minWidth: 44,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightPlaceholder: {
    width: 44,
  },
  pressed: {
    opacity: 0.7,
  },
});
