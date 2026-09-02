import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';

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
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const topPadding = Platform.OS === 'web' ? 10 : Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 10) + 4;

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
    <View style={[styles.headerContainer, { paddingTop: topPadding }]}>
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
            <Text style={styles.backLabel}>{t('common.back', 'Back')}</Text>
          </Pressable>
        ) : rightElement ? (
          <View style={styles.backPlaceholder} />
        ) : null}

        <View style={styles.titleContainer}>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={styles.headerSubtitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {rightElement ? (
          <View style={styles.rightSlot}>{rightElement}</View>
        ) : showBack ? (
          <View style={styles.rightPlaceholder} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.borderSubtle,
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 10,
    elevation: 2,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    minHeight: 44,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    gap: 4,
  },
  backIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ExecutiveTheme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  backLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  backPlaceholder: {
    minWidth: 44,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerTitle: {
    fontSize: 14.5,
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
    minWidth: 44,
  },
  pressed: {
    opacity: 0.7,
  },
});
