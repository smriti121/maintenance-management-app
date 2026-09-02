import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { UserRole } from '@/types/maintenance';

export type NavTab = 'home' | 'tasks' | 'create' | 'reports' | 'profile';

interface AppBottomNavProps {
  activeTab: NavTab;
  isStaff?: boolean;
  role?: UserRole;
}

export function AppBottomNav({ activeTab, isStaff, role }: AppBottomNavProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const staffMode = isStaff !== undefined ? isStaff : role === 'maintenance_staff';

  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 6 : 2);

  function handleTabPress(tab: NavTab) {
    if (tab === activeTab) return;

    if (!staffMode) {
      switch (tab) {
        case 'home':
          router.replace('/user/dashboard');
          break;
        case 'create':
          router.push('/user/create-request');
          break;
        case 'reports':
          router.replace('/user/reports');
          break;
        case 'profile':
          router.replace('/user/profile');
          break;
      }
    } else {
      switch (tab) {
        case 'home':
          router.replace('/staff/dashboard');
          break;
        case 'tasks':
          router.replace('/staff/work-queue');
          break;
        case 'reports':
          router.replace('/staff/reports');
          break;
        case 'profile':
          router.replace('/staff/profile');
          break;
      }
    }
  }

  const residentTabs = [
    {
      id: 'home' as NavTab,
      label: t('nav.home', 'Home'),
      iconActive: 'home' as const,
      iconInactive: 'home-outline' as const,
    },
    {
      id: 'create' as NavTab,
      label: t('nav.newRequest', 'New Request'),
      iconActive: 'add-circle' as const,
      iconInactive: 'add-circle-outline' as const,
    },
    {
      id: 'reports' as NavTab,
      label: t('nav.reports', 'Reports'),
      iconActive: 'stats-chart' as const,
      iconInactive: 'stats-chart-outline' as const,
    },
    {
      id: 'profile' as NavTab,
      label: t('nav.profile', 'Profile'),
      iconActive: 'person' as const,
      iconInactive: 'person-outline' as const,
    },
  ];

  const staffTabs = [
    {
      id: 'home' as NavTab,
      label: t('nav.dashboard', 'Dashboard'),
      iconActive: 'grid' as const,
      iconInactive: 'grid-outline' as const,
    },
    {
      id: 'tasks' as NavTab,
      label: t('nav.workQueue', 'Work Queue'),
      iconActive: 'construct' as const,
      iconInactive: 'construct-outline' as const,
    },
    {
      id: 'reports' as NavTab,
      label: t('nav.reports', 'Reports'),
      iconActive: 'stats-chart' as const,
      iconInactive: 'stats-chart-outline' as const,
    },
    {
      id: 'profile' as NavTab,
      label: t('nav.profile', 'Profile'),
      iconActive: 'person' as const,
      iconInactive: 'person-outline' as const,
    },
  ];

  const tabs = staffMode ? staffTabs : residentTabs;

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
              onPress={() => handleTabPress(tab.id)}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} tab`}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={20}
                  color={isActive ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
                />
              </View>
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: ExecutiveTheme.colors.borderSubtle,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    height: 50,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  iconContainer: {
    width: 32,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconContainerActive: {
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: 'rgba(245, 196, 0, 0.4)',
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.1,
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
});
