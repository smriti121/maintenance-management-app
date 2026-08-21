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
import { UserRole } from '@/types/maintenance';

export type BottomNavTab = 'home' | 'tasks' | 'create' | 'reports' | 'profile';

interface AppBottomNavProps {
  activeTab: BottomNavTab;
  role?: UserRole;
}

export function AppBottomNav({ activeTab, role = 'user' }: AppBottomNavProps) {
  const insets = useSafeAreaInsets();
  const isStaff = role === 'maintenance_staff';

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  function handleTabPress(tab: BottomNavTab) {
    if (tab === activeTab) return;

    if (!isStaff) {
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
      // Staff navigation
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

  // Resident Bottom Navigation (Home, New Request, Reports, Profile)
  if (!isStaff) {
    return (
      <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
        <View style={styles.navContainer}>
          {/* Tab 1: Home */}
          <Pressable
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
            onPress={() => handleTabPress('home')}
            accessibilityRole="button"
            accessibilityLabel="Home tab"
          >
            <View style={[styles.iconContainer, activeTab === 'home' && styles.iconContainerActive]}>
              <Ionicons
                name={activeTab === 'home' ? 'home' : 'home-outline'}
                size={22}
                color={activeTab === 'home' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'home' && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              Home
            </Text>
            {activeTab === 'home' && <View style={styles.activePill} />}
          </Pressable>

          {/* Tab 2: New Request (Resident Action Button) */}
          <Pressable
            style={({ pressed }) => [styles.actionTabButton, pressed && styles.tabPressed]}
            onPress={() => handleTabPress('create')}
            accessibilityRole="button"
            accessibilityLabel="New Request"
          >
            <View
              style={[
                styles.actionIconContainer,
                activeTab === 'create' && styles.actionIconContainerActive,
              ]}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.actionTabLabel,
                activeTab === 'create' && styles.actionTabLabelActive,
              ]}
              numberOfLines={1}
            >
              New Request
            </Text>
          </Pressable>

          {/* Tab 3: Reports */}
          <Pressable
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
            onPress={() => handleTabPress('reports')}
            accessibilityRole="button"
            accessibilityLabel="Reports tab"
          >
            <View style={[styles.iconContainer, activeTab === 'reports' && styles.iconContainerActive]}>
              <Ionicons
                name={activeTab === 'reports' ? 'stats-chart' : 'stats-chart-outline'}
                size={21}
                color={activeTab === 'reports' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'reports' && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              Reports
            </Text>
            {activeTab === 'reports' && <View style={styles.activePill} />}
          </Pressable>

          {/* Tab 4: Profile */}
          <Pressable
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
            onPress={() => handleTabPress('profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile tab"
          >
            <View style={[styles.iconContainer, activeTab === 'profile' && styles.iconContainerActive]}>
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={21}
                color={activeTab === 'profile' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'profile' && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              Profile
            </Text>
            {activeTab === 'profile' && <View style={styles.activePill} />}
          </Pressable>
        </View>
      </View>
    );
  }

  // Maintenance Staff Bottom Navigation (Dashboard, Work Queue, My Reports, Profile)
  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      <View style={styles.navContainer}>
        {/* Tab 1: Dashboard */}
        <Pressable
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
          onPress={() => handleTabPress('home')}
          accessibilityRole="button"
          accessibilityLabel="Dashboard tab"
        >
          <View style={[styles.iconContainer, activeTab === 'home' && styles.iconContainerActive]}>
            <Ionicons
              name={activeTab === 'home' ? 'grid' : 'grid-outline'}
              size={21}
              color={activeTab === 'home' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'home' && styles.tabLabelActive,
            ]}
            numberOfLines={1}
          >
            Dashboard
          </Text>
          {activeTab === 'home' && <View style={styles.activePill} />}
        </Pressable>

        {/* Tab 2: Work Queue (Filtered Active Tasks) */}
        <Pressable
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
          onPress={() => handleTabPress('tasks')}
          accessibilityRole="button"
          accessibilityLabel="Work Queue tab"
        >
          <View style={[styles.iconContainer, activeTab === 'tasks' && styles.iconContainerActive]}>
            <Ionicons
              name={activeTab === 'tasks' ? 'construct' : 'construct-outline'}
              size={21}
              color={activeTab === 'tasks' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'tasks' && styles.tabLabelActive,
            ]}
            numberOfLines={1}
          >
            Work Queue
          </Text>
          {activeTab === 'tasks' && <View style={styles.activePill} />}
        </Pressable>

        {/* Tab 3: Staff Performance Reports */}
        <Pressable
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
          onPress={() => handleTabPress('reports')}
          accessibilityRole="button"
          accessibilityLabel="Reports tab"
        >
          <View style={[styles.iconContainer, activeTab === 'reports' && styles.iconContainerActive]}>
            <Ionicons
              name={activeTab === 'reports' ? 'stats-chart' : 'stats-chart-outline'}
              size={21}
              color={activeTab === 'reports' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'reports' && styles.tabLabelActive,
            ]}
            numberOfLines={1}
          >
            My Reports
          </Text>
          {activeTab === 'reports' && <View style={styles.activePill} />}
        </Pressable>

        {/* Tab 4: Staff Profile */}
        <Pressable
          style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
          onPress={() => handleTabPress('profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile tab"
        >
          <View style={[styles.iconContainer, activeTab === 'profile' && styles.iconContainerActive]}>
            <Ionicons
              name={activeTab === 'profile' ? 'person' : 'person-outline'}
              size={21}
              color={activeTab === 'profile' ? ExecutiveTheme.colors.brandPrimary : ExecutiveTheme.colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'profile' && styles.tabLabelActive,
            ]}
            numberOfLines={1}
          >
            Profile
          </Text>
          {activeTab === 'profile' && <View style={styles.activePill} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: ExecutiveTheme.colors.border,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    minHeight: 48,
  },
  tabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  iconContainer: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconContainerActive: {
    backgroundColor: ExecutiveTheme.colors.brandLight,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabLabelActive: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
  activePill: {
    width: 16,
    height: 3,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderRadius: 2,
    marginTop: 2,
  },
  actionTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    minHeight: 48,
  },
  actionIconContainer: {
    width: 42,
    height: 30,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionIconContainerActive: {
    backgroundColor: ExecutiveTheme.colors.brandPrimaryHover,
  },
  actionTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  actionTabLabelActive: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
});
