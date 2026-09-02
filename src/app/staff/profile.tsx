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

export default function StaffProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
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

      const tasks = await MaintenanceService.getStaffRequests(user.id);
      setTaskCount(tasks.length);
      setResolvedCount(tasks.filter((t) => t.status === 'completed').length);
    } catch (err) {
      console.error('Staff profile load error:', err);
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
    : 'TC';

  return (
    <SafeAreaView style={styles.screen}>
      <ExecutiveHeader
        title={t('profile.technicianHeaderTitle', 'Technician Profile')}
        subtitle={t('profile.technicianSubtitle', 'Staff Credentials & Engineering Account')}
        showBack={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#F5C400" />
            </View>
          ) : (
            <>
              {/* Profile Header Card */}
              <View style={styles.profileHeaderCard}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={styles.avatarBadge}>
                    <Ionicons name="construct" size={12} color="#111111" />
                  </View>
                </View>

                <Text style={styles.userName}>
                  {profile?.full_name || t('staffDashboard.greetingFallback', 'Staff Technician')}
                </Text>
                <Text style={styles.userEmail}>{profile?.email || 'N/A'}</Text>

                <View style={styles.roleChip}>
                  <Ionicons name="shield-checkmark" size={13} color="#F5C400" />
                  <Text style={styles.roleChipText}>
                    {t('profile.roleStaff', 'Certified Maintenance Staff').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Language Selection Card */}
              <LanguageSelector />

              {/* Workload & Service Performance */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('profile.serviceRecordTitle', 'SERVICE RECORD & WORKLOAD')}</Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="briefcase-outline" size={15} color="#F5C400" />
                    </View>
                    <Text style={styles.statNumber}>{taskCount}</Text>
                    <Text style={styles.statLabel}>{t('staffDashboard.assignedTasks', 'Assigned')}</Text>
                  </View>

                  <View style={[styles.statBox, styles.statBoxHighlight]}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#2B2B2B', borderColor: '#F5C400' }]}>
                      <Ionicons name="checkmark-done-circle-outline" size={15} color="#F5C400" />
                    </View>
                    <Text style={[styles.statNumber, { color: '#F5C400' }]}>{resolvedCount}</Text>
                    <Text style={[styles.statLabel, { color: '#F5C400' }]}>{t('staffDashboard.resolvedTasks', 'Resolved')}</Text>
                  </View>

                  <View style={styles.statBox}>
                    <View style={styles.statIconWrap}>
                      <Ionicons name="flash-outline" size={15} color="#F5C400" />
                    </View>
                    <Text style={styles.statNumber}>{taskCount - resolvedCount}</Text>
                    <Text style={styles.statLabel}>{t('staffReports.activeWorkload', 'Active')}</Text>
                  </View>
                </View>
              </View>

              {/* Account & Security Information */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('profile.credentialsTitle', 'CREDENTIALS & DISPATCH')}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('auth.fullName', 'Full Name')}</Text>
                  <Text style={styles.infoValue}>{profile?.full_name || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.staffEmailLabel', 'Staff Email')}</Text>
                  <Text style={styles.infoValue}>{profile?.email || 'N/A'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.systemRoleLabel', 'System Role')}</Text>
                  <Text style={styles.infoValue}>{t('profile.roleStaff', 'Certified Maintenance Staff')}</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>{t('profile.facilityDeskHotline', 'Facility Desk Hotline')}</Text>
                  <View style={styles.hotlineWrap}>
                    <Ionicons name="call" size={13} color="#F5C400" />
                    <Text style={styles.hotlineText}>1800-349-3569</Text>
                  </View>
                </View>
              </View>

              {/* App Info */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('profile.appInfoTitle', 'APPLICATION INFO')}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.applicationLabel', 'Application')}</Text>
                  <Text style={styles.infoValue}>FixFlow</Text>
                </View>

                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>{t('profile.appVersion', 'Version')}</Text>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>{t('profile.productionBadge', 'v1.0.0 (Production)')}</Text>
                  </View>
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

      <AppBottomNav activeTab="profile" isStaff={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
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
    backgroundColor: '#202020',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2B2B2B',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#262626',
    borderWidth: 2.5,
    borderColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#202020',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F5C400',
    letterSpacing: 1.5,
  },
  userName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 13,
    color: '#888888',
    marginTop: 3,
    fontWeight: '500',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#262626',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 5,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  roleChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F5C400',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: '#202020',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  sectionHeaderAccent: {
    width: 3,
    height: 12,
    backgroundColor: '#F5C400',
    borderRadius: 2,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E5E5E5',
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statBoxHighlight: {
    borderColor: '#F5C400',
    backgroundColor: '#2B2B2B',
  },
  statIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888888',
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 0.8,
    borderBottomColor: '#2B2B2B',
  },
  infoLabel: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  hotlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  hotlineText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F5C400',
  },
  versionBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E5E5E5',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 14,
    paddingVertical: 13,
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
    opacity: 0.78,
  },
});
