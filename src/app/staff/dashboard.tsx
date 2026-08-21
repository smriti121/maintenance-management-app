import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';
import { confirmAction } from '@/utils/alert';

export default function StaffDashboard() {
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setStaffProfile(profile as Profile);
      }

      // 2. Fetch Tasks assigned to this staff member
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

      // 1. Setup Supabase Realtime listener for instant live updates
      const channel = supabase
        .channel('staff_dashboard_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_requests' },
          () => {
            loadData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_request_photos' },
          () => {
            loadData();
          }
        )
        .subscribe();

      // 2. Periodic background poll every 3 seconds for guaranteed live sync across devices
      const interval = setInterval(() => {
        loadData();
      }, 3000);

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }, [loadData])
  );

  async function handleSignOut() {
    confirmAction({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your technician account?',
      confirmText: 'Sign Out',
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

  const activeTasks = tasks.filter((t) =>
    ['assigned', 'in_progress', 'on_hold', 'pending'].includes(t.status || 'pending')
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');
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
      <View style={styles.contentContainer}>
        {/* iOS Top Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.staffBadge}>
              <Text style={styles.staffBadgeIcon}>🔧</Text>
              <Text style={styles.staffBadgeText}>Technician Portal</Text>
            </View>
            <Text style={styles.greetingText} numberOfLines={1}>
              {staffProfile?.full_name || 'Technician'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Workload Metrics Cards */}
        <View style={styles.metricsContainer}>
          <View style={[styles.metricCard, styles.metricCardBlue]}>
            <Text style={[styles.metricNumber, { color: '#007AFF' }]} numberOfLines={1}>
              {activeTasks.length}
            </Text>
            <Text style={styles.metricLabel}>Queue</Text>
          </View>

          <View style={[styles.metricCard, styles.metricCardRed]}>
            <Text style={[styles.metricNumber, { color: '#FF3B30' }]} numberOfLines={1}>
              {urgentTasks.length}
            </Text>
            <Text style={styles.metricLabel}>Urgent</Text>
          </View>

          <View style={[styles.metricCard, styles.metricCardGreen]}>
            <Text style={[styles.metricNumber, { color: '#34C759' }]} numberOfLines={1}>
              {completedTasks.length}
            </Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>

        {/* Workload Status Banner */}
        <View style={styles.workloadBanner}>
          <Text style={styles.workloadBannerText} numberOfLines={2}>
            ⚡ <Text style={{ fontWeight: '700' }}>Workload Status:</Text>{' '}
            {activeTasks.length === 0
              ? 'Ready for new auto-assignments'
              : `${activeTasks.length} active tasks assigned`}
          </Text>
        </View>

        {/* iOS Segmented Filter Tabs */}
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentTab, filter === 'active' && styles.activeSegmentTab]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.segmentText, filter === 'active' && styles.activeSegmentText]} numberOfLines={1}>
              Active ({activeTasks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, filter === 'completed' && styles.activeSegmentTab]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.segmentText, filter === 'completed' && styles.activeSegmentText]} numberOfLines={1}>
              Resolved ({completedTasks.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, filter === 'all' && styles.activeSegmentTab]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.segmentText, filter === 'all' && styles.activeSegmentText]} numberOfLines={1}>
              All ({tasks.length})
            </Text>
          </Pressable>
        </View>

        {/* Tasks List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading technician queue...</Text>
          </View>
        ) : (
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
                tintColor="#007AFF"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>Queue is Clear!</Text>
                <Text style={styles.emptySub}>
                  {filter === 'active'
                    ? 'You currently have no active maintenance tasks assigned.'
                    : 'No tasks matching this filter.'}
                </Text>
              </View>
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
                      ? new Date(item.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Today'}
                  </Text>
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {/* Requester Info Box */}
                <View style={styles.requesterBox}>
                  <Text style={styles.requesterIcon}>👤</Text>
                  <Text style={styles.requesterText} numberOfLines={1}>
                    Resident: {item.requester?.full_name || item.requester?.email || 'Resident'}
                  </Text>
                </View>

                {/* Photos Preview */}
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

                {/* Action Prompt */}
                <View style={styles.cardFooter}>
                  <Text style={styles.actionPrompt}>Manage Task & Log Time ›</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: Platform.OS === 'web' ? 24 : 8,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  headerTitleGroup: {
    flex: 1,
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  staffBadgeIcon: {
    fontSize: 11,
  },
  staffBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  signOutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  signOutText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FF3B30',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  metricCardBlue: {
    backgroundColor: '#F2F7FF',
  },
  metricCardRed: {
    backgroundColor: '#FFF4F4',
  },
  metricCardGreen: {
    backgroundColor: '#F2FAF4',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  workloadBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
  },
  workloadBannerText: {
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeSegmentTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeSegmentText: {
    color: '#000000',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: '#F2F2F7',
    transform: [{ scale: 0.995 }],
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
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardDate: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 13.5,
    color: '#636366',
    lineHeight: 18,
    marginBottom: 10,
  },
  requesterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  requesterIcon: {
    fontSize: 13,
  },
  requesterText: {
    fontSize: 12.5,
    color: '#636366',
    fontWeight: '600',
    flex: 1,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  thumbImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  morePhotosBadge: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  morePhotosText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#636366',
  },
  cardFooter: {
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F2F2F7',
    alignItems: 'flex-end',
  },
  actionPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13.5,
    color: '#8E8E93',
    fontWeight: '500',
  },
  emptyCard: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13.5,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.85,
  },
});
