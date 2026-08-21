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
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

export default function StaffDashboard() {
  const params = useLocalSearchParams<{ filter?: 'active' | 'completed' | 'all' }>();
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>(params.filter || 'all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    if (filter === 'active') {
      return ['assigned', 'in_progress', 'on_hold', 'pending'].includes(task.status || 'pending');
    }
    if (filter === 'completed') {
      return task.status === 'completed';
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top App Bar Header Wrapper */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerRow}>
          <View style={styles.userInfoGroup}>
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
            <View style={styles.userTextGroup}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {staffProfile?.full_name || 'Staff Technician'}
              </Text>
              <Text style={styles.unitText} numberOfLines={1}>
                Certified Maintenance Engineering Staff
              </Text>
            </View>
          </View>

          {/* Right Header: Active Duty Pill & Refresh */}
          <View style={styles.headerRightGroup}>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>On Duty</Text>
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
              {/* Symmetrical 4-Column Balanced Metric Grid */}
              <View style={styles.metricsContainer}>
                <View style={[styles.metricCard, styles.metricCardAssigned]}>
                  <View style={styles.metricIconWrap}>
                    <Ionicons name="file-tray-full-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
                  </View>
                  <View style={styles.metricTextWrap}>
                    <Text style={styles.metricNumber}>{assignedCount}</Text>
                    <Text style={styles.metricLabel}>ASSIGNED</Text>
                  </View>
                </View>

                <View style={[styles.metricCard, styles.metricCardProgress]}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="construct-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={styles.metricTextWrap}>
                    <Text style={[styles.metricNumber, { color: '#2563EB' }]}>{inProgressCount}</Text>
                    <Text style={[styles.metricLabel, { color: '#2563EB' }]}>IN PROGRESS</Text>
                  </View>
                </View>

                <View style={[styles.metricCard, styles.metricCardHold]}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="pause-circle-outline" size={18} color="#D97706" />
                  </View>
                  <View style={styles.metricTextWrap}>
                    <Text style={[styles.metricNumber, { color: '#D97706' }]}>{onHoldCount}</Text>
                    <Text style={[styles.metricLabel, { color: '#D97706' }]}>ON HOLD</Text>
                  </View>
                </View>

                <View style={[styles.metricCard, styles.metricCardSuccess]}>
                  <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                  </View>
                  <View style={styles.metricTextWrap}>
                    <Text style={[styles.metricNumber, { color: '#059669' }]}>{completedCount}</Text>
                    <Text style={[styles.metricLabel, { color: '#059669' }]}>RESOLVED</Text>
                  </View>
                </View>
              </View>

              {/* Urgent Priority Alert Banner */}
              {urgentTasks.length > 0 && (
                <View style={styles.urgentBanner}>
                  <Ionicons name="alert-circle" size={20} color="#E11D48" />
                  <View style={styles.urgentTextGroup}>
                    <Text style={styles.urgentTitle}>Priority Dispatch Alert</Text>
                    <Text style={styles.urgentSubtitle}>
                      {urgentTasks.length} urgent/high priority order(s) require prompt attention.
                    </Text>
                  </View>
                </View>
              )}

              {/* Segmented Filter Control */}
              <View style={styles.filterSection}>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[styles.segmentTab, filter === 'active' && styles.activeSegmentTab]}
                    onPress={() => setFilter('active')}
                  >
                    <Text
                      style={[styles.segmentText, filter === 'active' && styles.activeSegmentText]}
                      numberOfLines={1}
                    >
                      Active Queue ({activeTasks.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.segmentTab, filter === 'completed' && styles.activeSegmentTab]}
                    onPress={() => setFilter('completed')}
                  >
                    <Text
                      style={[styles.segmentText, filter === 'completed' && styles.activeSegmentText]}
                      numberOfLines={1}
                    >
                      Resolved ({completedCount})
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.segmentTab, filter === 'all' && styles.activeSegmentTab]}
                    onPress={() => setFilter('all')}
                  >
                    <Text
                      style={[styles.segmentText, filter === 'all' && styles.activeSegmentText]}
                      numberOfLines={1}
                    >
                      All Orders ({tasks.length})
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
                <Text style={styles.loadingText}>Syncing dispatch queue...</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="checkmark-done-outline" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>Work Queue Clear</Text>
                <Text style={styles.emptySub}>
                  {filter === 'active'
                    ? 'No active maintenance tasks in your dispatch queue.'
                    : `No ${filter} work orders recorded.`}
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
                    : 'Today'}
                </Text>
              </View>

              <Text style={styles.taskTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.taskDesc} numberOfLines={2}>
                {item.description}
              </Text>

              {/* Resident Info Box */}
              <View style={styles.residentBox}>
                <Text style={styles.residentLabel}>RESIDENT:</Text>
                <Text style={styles.residentName}>
                  {item.requester?.full_name || item.requester?.email || 'Resident'}
                </Text>
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
                  <Text style={styles.openWorkspaceText}>Open Workspace</Text>
                  <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>

      <AppBottomNav activeTab="home" role="maintenance_staff" />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
  },
  userInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...ExecutiveTheme.shadows.soft,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userTextGroup: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  unitText: {
    fontSize: 11.5,
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
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
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 66,
    ...ExecutiveTheme.shadows.soft,
  },
  metricCardAssigned: {
    backgroundColor: '#FFFFFF',
  },
  metricCardProgress: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  metricCardHold: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  metricCardSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    lineHeight: 22,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  urgentTextGroup: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9F1239',
  },
  urgentSubtitle: {
    fontSize: 11.5,
    color: '#881337',
    marginTop: 1,
  },
  filterSection: {
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 11,
    padding: 3,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeSegmentTab: {
    backgroundColor: ExecutiveTheme.colors.surface,
    ...ExecutiveTheme.shadows.soft,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  activeSegmentText: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 12,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
  },
  taskCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    ...ExecutiveTheme.shadows.soft,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardDate: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  residentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  residentLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
  },
  residentName: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  thumbImage: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  morePhotosBadge: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  morePhotosText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: ExecutiveTheme.colors.borderSubtle,
  },
  workOrderRef: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textMuted,
  },
  openWorkspaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  openWorkspaceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
