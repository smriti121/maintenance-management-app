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

export default function UserDashboard() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
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

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile as Profile);
      }

      // Fetch user's maintenance requests
      const data = await MaintenanceService.getUserRequests(user.id);
      setRequests(data);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
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
        .channel('user_dashboard_realtime')
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
      message: 'Are you sure you want to sign out of your account?',
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

  const filteredRequests = requests.filter((req) => {
    if (filter === 'active') {
      return ['pending', 'assigned', 'in_progress', 'on_hold'].includes(req.status || 'pending');
    }
    if (filter === 'completed') {
      return req.status === 'completed';
    }
    return true;
  });

  const activeCount = requests.filter((r) =>
    ['pending', 'assigned', 'in_progress', 'on_hold'].includes(r.status || 'pending')
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.contentContainer}>
        {/* iOS Header & User Profile Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.greetingText} numberOfLines={1}>
              Hi, {userProfile?.full_name?.split(' ')[0] || 'Resident'} 👋
            </Text>
            <Text style={styles.portalSubtitle}>Resident Portal</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        {/* iOS Metric Cards Group */}
        <View style={styles.metricsContainer}>
          <View style={[styles.metricCard, styles.metricCardBlue]}>
            <Text style={[styles.metricNumber, { color: '#007AFF' }]} numberOfLines={1}>
              {requests.length}
            </Text>
            <Text style={styles.metricLabel}>Total</Text>
          </View>

          <View style={[styles.metricCard, styles.metricCardOrange]}>
            <Text style={[styles.metricNumber, { color: '#FF9500' }]} numberOfLines={1}>
              {activeCount}
            </Text>
            <Text style={styles.metricLabel}>Active</Text>
          </View>

          <View style={[styles.metricCard, styles.metricCardGreen]}>
            <Text style={[styles.metricNumber, { color: '#34C759' }]} numberOfLines={1}>
              {completedCount}
            </Text>
            <Text style={styles.metricLabel}>Resolved</Text>
          </View>
        </View>

        {/* Primary Action Button */}
        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
          onPress={() => router.push('/user/create-request')}
        >
          <Text style={styles.createBtnIcon}>＋</Text>
          <Text style={styles.createBtnText}>New Maintenance Request</Text>
        </Pressable>

        {/* iOS Segmented Filter Controls */}
        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentTab, filter === 'all' && styles.activeSegmentTab]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.segmentText, filter === 'all' && styles.activeSegmentText]} numberOfLines={1}>
              All ({requests.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, filter === 'active' && styles.activeSegmentTab]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.segmentText, filter === 'active' && styles.activeSegmentText]} numberOfLines={1}>
              Active ({activeCount})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentTab, filter === 'completed' && styles.activeSegmentTab]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.segmentText, filter === 'completed' && styles.activeSegmentText]} numberOfLines={1}>
              Resolved ({completedCount})
            </Text>
          </Pressable>
        </View>

        {/* Requests List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading maintenance requests...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
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
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Requests</Text>
                <Text style={styles.emptySub}>
                  {filter === 'all'
                    ? 'You have not submitted any maintenance requests yet.'
                    : `No ${filter} requests right now.`}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.requestCard, pressed && styles.cardPressed]}
                onPress={() =>
                  router.push({
                    pathname: '/user/request-detail',
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

                {/* Photos Thumbnail Preview */}
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

                {/* Assignee / Auto-assignment indicator */}
                <View style={styles.cardFooter}>
                  {item.assignee ? (
                    <View style={styles.assigneeRow}>
                      <Text style={styles.assigneeIcon}>👤</Text>
                      <Text style={styles.assigneeText} numberOfLines={1}>
                        Assigned: {item.assignee.full_name || item.assignee.email}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.assigneeRow}>
                      <Text style={styles.assigneeIcon}>⚡</Text>
                      <Text style={styles.unassignedText} numberOfLines={1}>
                        Auto-assigning to staff...
                      </Text>
                    </View>
                  )}
                  <Text style={styles.chevron}>›</Text>
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
  greetingText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  portalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 2,
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
  metricCardOrange: {
    backgroundColor: '#FFF9F2',
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
  createBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 14,
  },
  createBtnIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
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
  requestCard: {
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
  thumbnailRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  thumbImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  morePhotosBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  morePhotosText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#636366',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F2F2F7',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  assigneeIcon: {
    fontSize: 13,
  },
  assigneeText: {
    fontSize: 12.5,
    color: '#636366',
    fontWeight: '600',
    flex: 1,
  },
  unassignedText: {
    fontSize: 12.5,
    color: '#FF9500',
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '400',
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
