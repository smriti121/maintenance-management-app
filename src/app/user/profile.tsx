import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { ExecutiveHeader } from '@/components/executive-header';
import { LanguageSelector } from '@/components/language-selector';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { Profile } from '@/types/maintenance';
import { confirmAction } from '@/utils/alert';

export default function UserProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
      }

      const requests = await MaintenanceService.getUserRequests(user.id);
      setRequestCount(requests.length);
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function handleSignOut() {
    confirmAction({
      title: t('profile.signOutConfirmTitle', 'Sign Out'),
      message: t('profile.signOutConfirmMessage', 'Are you sure you want to sign out of FixFlow?'),
      confirmText: t('common.signOut', 'Sign Out'),
      destructive: true,
      onConfirm: async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.warn('Sign out error:', err);
        }
        router.replace('/');
      },
    });
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'RS';

  return (
    <SafeAreaView style={styles.screen}>
      <ExecutiveHeader
        title={t('profile.headerTitle', 'Resident Profile')}
        subtitle={t('profile.headerSubtitle', 'Preferences & Account Management')}
        showBack={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
            </View>
          ) : (
            <>
              {/* Profile Header Card */}
              <View style={styles.profileHeaderCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <Text style={styles.userName}>{profile?.full_name || t('userDashboard.greetingFallback', 'Resident Portal')}</Text>
                <Text style={styles.userEmail}>{profile?.email || 'N/A'}</Text>

                <View style={styles.roleChip}>
                  <Text style={styles.roleChipText}>{t('profile.roleResident', 'Apartment Resident').toUpperCase()}</Text>
                </View>
              </View>

              {/* Language Selection Card */}
              <LanguageSelector />

              {/* Account Information Card */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>{t('profile.accountDetailsTitle', 'ACCOUNT DETAILS')}</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('auth.fullName', 'Full Name')}</Text>
                  <Text style={styles.infoValue}>{profile?.full_name || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('auth.email', 'Email Address')}</Text>
                  <Text style={styles.infoValue}>{profile?.email || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.accountRoleLabel', 'Account Role')}</Text>
                  <Text style={styles.infoValue}>{t('profile.roleResident', 'Apartment Resident')}</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>{t('userReports.totalRequests', 'Total Requests')}</Text>
                  <Text style={styles.infoValue}>
                    {requestCount} {t('profile.workOrdersUnit', 'work orders')}
                  </Text>
                </View>
              </View>

              {/* Facility Support & Emergency Helpdesk */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>{t('profile.supportSectionTitle', 'FACILITY SUPPORT & HELPDESK')}</Text>

                <View style={styles.helpRow}>
                  <View style={styles.helpIconCircle}>
                    <Ionicons name="business-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
                  </View>
                  <View style={styles.helpContent}>
                    <Text style={styles.helpTitle}>{t('profile.helpdeskTitle', 'Central Maintenance Helpdesk')}</Text>
                    <Text style={styles.helpSubtitle}>{t('profile.helpdeskSub', '24/7 Dispatch Desk: 1800-349-3569')}</Text>
                  </View>
                </View>

                <View style={styles.helpRow}>
                  <View style={[styles.helpIconCircle, { backgroundColor: '#202020', borderWidth: 1, borderColor: '#2B2B2B' }]}>
                    <Ionicons name="call-outline" size={18} color="#F5C400" />
                  </View>
                  <View style={styles.helpContent}>
                    <Text style={styles.helpTitle}>{t('profile.emergencyHotlineTitle', 'Emergency Facility Hotline')}</Text>
                    <Text style={styles.helpSubtitle}>
                      {t('profile.emergencyHotlineSub', 'Water burst, electrical spark, fire alarm')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* System Information */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>{t('profile.appInfoTitle', 'APPLICATION INFO')}</Text>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.applicationLabel', 'Application')}</Text>
                  <Text style={styles.infoValue}>FixFlow</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>{t('profile.appVersion', 'Version')}</Text>
                  <Text style={styles.infoValue}>{t('profile.productionBadge', 'v1.0.0 (Production)')}</Text>
                </View>
              </View>

              {/* Sign Out Button */}
              <Pressable
                style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
                onPress={handleSignOut}
              >
                <Ionicons name="log-out-outline" size={16} color="#E5E5E5" />
                <Text style={styles.signOutBtnText}>{t('profile.signOutBtn', 'Sign Out of Account')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <AppBottomNav activeTab="profile" role="user" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 90,
  },
  container: {
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    gap: 14,
  },
  profileHeaderCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#2B2B2B',
    borderWidth: 2,
    borderColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F5C400',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 2,
  },
  roleChip: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandPrimary,
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.8,
    borderBottomColor: ExecutiveTheme.colors.borderSubtle,
  },
  infoLabel: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '700',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  helpIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2B2B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpContent: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  helpSubtitle: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  signOutBtnText: {
    color: '#E5E5E5',
    fontSize: 13.5,
    fontWeight: '800',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  pressed: {
    opacity: 0.75,
  },
});
