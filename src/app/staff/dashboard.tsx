import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StaffDashboard() {
  const params = useLocalSearchParams<{ filter?: 'active' | 'completed' | 'all' }>();
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>(params.filter || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (params.filter) {
      setFilter(params.filter);
    }
  }, [params.filter]);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setStaffProfile(profile as Profile);
      }

      const data = await MaintenanceService.getStaffRequests(user.id);
      setTasks(data);
    } catch (err: any) {
      console.error('Error loading staff dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();

      const channel = supabase
        .channel('staff_dashboard_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_requests' },
          () => loadData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_request_photos' },
          () => loadData()
        )
        .subscribe();

      const interval = setInterval(() => {
        loadData();
      }, 4000);

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }, [loadData])
  );

  const assignedCount = tasks.filter((t) => t.status === 'assigned' || t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const onHoldCount = tasks.filter((t) => t.status === 'on_hold').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const activeTasks = tasks.filter((t) =>
    ['assigned', 'in_progress', 'on_hold', 'pending'].includes(t.status || 'pending')
  );
  const urgentTasks = activeTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');

  const filteredTasks = tasks.filter((task) => {
    // 1. Status Filter
    if (filter === 'active') {
      if (!['assigned', 'in_progress', 'on_hold', 'pending'].includes(task.status || 'pending')) {
        return false;
      }
    } else if (filter === 'completed') {
      if (task.status !== 'completed') {
        return false;
      }
    }

    // 2. Search Query Matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchResident = (task.requester?.full_name || task.requester?.email || '').toLowerCase().includes(q);
      const matchRef = (task.id || '').toLowerCase().includes(q);
      const matchEquip = (task.equipment?.name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchResident && !matchRef && !matchEquip) return false;
    }

    return true;
  });

  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? 10 : Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 10) + 4;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top App Bar Header Wrapper */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>
                {staffProfile?.full_name
                  ? staffProfile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : 'TC'}
              </Text>
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {staffProfile?.full_name || t('staffDashboard.greetingFallback', 'Staff Technician')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('staffDashboard.verifiedStaff', 'Certified Maintenance Engineering Staff')}
              </Text>
            </View>
          </View>

          {/* Right Header: Active Duty Pill & Refresh */}
          <View style={styles.headerRightGroup}>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>{t('staffDashboard.onDuty', 'On Duty')}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.refreshIconBtn, pressed && styles.pressed]}
              onPress={() => {
                setRefreshing(true);
                loadData();
              }}
              hitSlop={8}
            >
              <Ionicons name="refresh-outline" size={17} color={ExecutiveTheme.colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Centered Scrollable Main Content Container */}
      <View style={styles.mainFeedWrapper}>
        <FlatList
          style={styles.flatList}
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={ExecutiveTheme.colors.brandPrimary}
            />
          }
          ListHeaderComponent={
            <View style={styles.dashboardHeader}>
              {/* Responsive Metrics: 4 in 1 Row on Desktop/Tablet, 2x2 on Mobile */}
              {!isMobile ? (
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, styles.metricCardAssigned]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="file-tray-full-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{assignedCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('staffDashboard.assignedTasks', 'ASSIGNED')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardProgress]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="construct-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{inProgressCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('staffDashboard.inProgressTasks', 'IN PROGRESS')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardHold]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="pause-circle-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{onHoldCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('staffDashboard.onHoldTasks', 'ON HOLD')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardSuccess]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="checkmark-circle-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('staffDashboard.resolvedTasks', 'RESOLVED')}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.metricsContainer}>
                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardAssigned]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="file-tray-full-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{assignedCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('staffDashboard.assignedTasks', 'ASSIGNED')}
                      </Text>
                    </View>

                    <View style={[styles.metricCard, styles.metricCardProgress]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="construct-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{inProgressCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('staffDashboard.inProgressTasks', 'IN PROGRESS')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardHold]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="pause-circle-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{onHoldCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('staffDashboard.onHoldTasks', 'ON HOLD')}
                      </Text>
                    </View>

                    <View style={[styles.metricCard, styles.metricCardSuccess]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="checkmark-circle-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('staffDashboard.resolvedTasks', 'RESOLVED')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Urgent Priority Alert Banner */}
              {urgentTasks.length > 0 && (
                <View style={styles.urgentBanner}>
                  <Ionicons name="alert-circle" size={18} color="#F5C400" />
                  <View style={styles.urgentTextGroup}>
                    <Text style={styles.urgentTitle}>{t('staffDashboard.urgentBannerTitle', 'Priority Dispatch Alert')}</Text>
                    <Text style={styles.urgentSubtitle}>
                      {urgentTasks.length} {t('staffDashboard.urgentBannerSub', 'urgent/high priority order(s) require prompt attention.')}
                    </Text>
                  </View>
                </View>
              )}

              {/* Search Bar matching Work Queue */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={ExecutiveTheme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('staffDashboard.searchPlaceholder', 'Search assigned orders, residents, or REF #')}
                  placeholderTextColor={ExecutiveTheme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={ExecutiveTheme.colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Filter Chips matching Work Queue */}
              <View style={styles.filterChipRow}>
                <Pressable
                  style={[styles.filterChip, filter === 'active' && styles.filterChipActive]}
                  onPress={() => setFilter('active')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'active' && styles.filterChipTextActive]}
                  >
                    {t('staffDashboard.activeQueue', 'Active Queue')} ({activeTasks.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
                  onPress={() => setFilter('completed')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'completed' && styles.filterChipTextActive]}
                  >
                    {t('staffDashboard.resolvedTab', 'Resolved')} ({completedCount})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                  onPress={() => setFilter('all')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}
                  >
                    {t('staffDashboard.allOrdersTab', 'All Orders')} ({tasks.length})
                  </Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
                <Text style={styles.loadingText}>{t('common.loading', 'Loading...')}</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="checkmark-done-outline" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>{t('staffDashboard.emptyTitle', 'Work Queue Clear')}</Text>
                <Text style={styles.emptySub}>
                  {filter === 'active'
                    ? t('staffDashboard.emptySub', 'No active maintenance tasks in your dispatch queue.')
                    : t('staffDashboard.emptyFilteredSub', 'No work orders recorded for this filter.')}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.taskCard, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: '/staff/task-detail',
                  params: { id: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgesRow}>
                  <StatusBadge status={item.status || 'pending'} size="small" />
                  <PriorityBadge priority={item.priority || 'medium'} size="small" />
                </View>
                <Text style={styles.cardDate}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : t('common.today', 'Today')}
                </Text>
              </View>

              <Text style={styles.taskTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.description ? (
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Clean Resident Info Row */}
              <View style={styles.residentBox}>
                <View style={styles.residentAvatarMini}>
                  <Ionicons name="person" size={11} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.residentName}>
                  {item.requester?.full_name || item.requester?.email || t('auth.resident', 'Resident')}
                </Text>
                {item.equipment?.name && (
                  <>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Ionicons name="hardware-chip-outline" size={12} color={ExecutiveTheme.colors.textSecondary} />
                    <Text style={styles.equipmentNameText} numberOfLines={1}>{item.equipment.name}</Text>
                  </>
                )}
              </View>

              {item.photos && item.photos.length > 0 && (
                <View style={styles.thumbnailRow}>
                  {item.photos.slice(0, 4).map((p, idx) => (
                    <Image
                      key={p.id || idx}
                      source={{ uri: p.url }}
                      style={styles.thumbImage}
                      contentFit="cover"
                    />
                  ))}
                  {item.photos.length > 4 && (
                    <View style={styles.morePhotosBadge}>
                      <Text style={styles.morePhotosText}>+{item.photos.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.workOrderRef}>
                  REF: #{(item.id || '').slice(0, 8).toUpperCase()}
                </Text>
                <View style={styles.openWorkspaceChip}>
                  <Text style={styles.openWorkspaceText}>{t('common.openWorkspace', 'Open Workspace')}</Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>

      <AppBottomNav activeTab="home" isStaff={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  headerWrapper: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.border,
    width: '100%',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F5C400',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F5C400',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F5C400',
  },
  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  mainFeedWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  dashboardHeader: {
    paddingTop: 14,
    marginBottom: 10,
    gap: 10,
  },
  metricsContainer: {
    gap: 10,
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metricPairRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: 'center',
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricCardAssigned: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardProgress: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardHold: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardResolved: {
    backgroundColor: '#2B2B2B',
    borderColor: '#F5C400',
  },
  metricCardSuccess: {
    backgroundColor: '#2B2B2B',
    borderColor: '#F5C400',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#888888',
    letterSpacing: 0.5,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#F5C400',
    borderRadius: 12,
    padding: 10,
  },
  urgentTextGroup: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  urgentSubtitle: {
    fontSize: 11,
    color: '#E5E5E5',
    marginTop: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExecutiveTheme.colors.surface,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '500',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.surface,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  filterChipActive: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderColor: ExecutiveTheme.colors.brandPrimary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#111111',
    fontWeight: '800',
  },
  flatList: {
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 12,
    width: '100%',
  },
  taskCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardDate: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  taskDesc: {
    fontSize: 12.5,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 17,
    marginBottom: 6,
  },
  residentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  residentAvatarMini: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2B2B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  residentName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  dotSeparator: {
    color: '#888888',
    fontSize: 11,
    marginHorizontal: 1,
  },
  equipmentNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  morePhotosBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2B2B2B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  morePhotosText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F5C400',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: ExecutiveTheme.colors.borderSubtle,
  },
  workOrderRef: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#888888',
    letterSpacing: 0.2,
  },
  openWorkspaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  openWorkspaceText: {
    color: '#111111',
    fontSize: 11.5,
    fontWeight: '800',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
