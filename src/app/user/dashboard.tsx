import { Ionicons } from '@expo/vector-icons';
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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

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

      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile as Profile);
      }

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

      const channel = supabase
        .channel('user_dashboard_realtime')
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

  const filteredRequests = requests.filter((req) => {
    if (filter === 'active') {
      return ['pending', 'assigned', 'in_progress', 'on_hold'].includes(req.status || 'pending');
    }
    if (filter === 'completed') {
      return req.status === 'completed';
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const inProgressCount = requests.filter((r) =>
    ['assigned', 'in_progress', 'on_hold'].includes(r.status || '')
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  const quickShortcuts = [
    { label: 'Fan Issue', icon: 'sync-outline' as const, title: 'Ceiling Fan Not Working' },
    { label: 'Bulb / Light', icon: 'bulb-outline' as const, title: 'Bulb / Light Replacement' },
    { label: 'AC Service', icon: 'snow-outline' as const, title: 'Air Conditioner Cooling Malfunction' },
    { label: 'Plumbing', icon: 'water-outline' as const, title: 'Water Pipe / Tap Leakage' },
    { label: 'Electrical', icon: 'flash-outline' as const, title: 'Electrical Switch / Socket Spark' },
  ];

  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 10
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top Header App Bar (Centered & Responsive) */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding + 6 }]}>
        <View style={styles.headerRow}>
          <View style={styles.userInfoGroup}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>
                {userProfile?.full_name
                  ? userProfile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : 'RS'}
              </Text>
            </View>
            <View style={styles.userTextGroup}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {userProfile?.full_name || 'Resident Portal'}
              </Text>
              <Text style={styles.unitText} numberOfLines={1}>
                Apartment Resident • Verified
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.newHeaderBtn, pressed && styles.pressed]}
            onPress={() => router.push('/user/create-request')}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.newHeaderBtnText}>New Request</Text>
          </Pressable>
        </View>
      </View>

      {/* Centered Scrollable Main Content Container */}
      <View style={styles.mainFeedWrapper}>
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
              tintColor={ExecutiveTheme.colors.brandPrimary}
            />
          }
          ListHeaderComponent={
            <View style={styles.dashboardHeader}>
              {/* Responsive Metrics: 4 in 1 Row on Desktop/Tablet, 2x2 on Mobile */}
              {!isMobile ? (
                <View style={styles.metricsRow}>
                  <View style={[styles.metricCard, styles.metricCardTotal]}>
                    <View style={styles.metricIconWrap}>
                      <Ionicons name="documents-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
                    </View>
                    <View style={styles.metricTextWrap}>
                      <Text style={styles.metricNumber}>{requests.length}</Text>
                      <Text style={styles.metricLabel}>TOTAL</Text>
                    </View>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardProgress]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="time-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={styles.metricTextWrap}>
                      <Text style={[styles.metricNumber, { color: '#2563EB' }]}>{inProgressCount}</Text>
                      <Text style={[styles.metricLabel, { color: '#2563EB' }]}>IN PROGRESS</Text>
                    </View>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardPending]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
                      <Ionicons name="hourglass-outline" size={18} color="#D97706" />
                    </View>
                    <View style={styles.metricTextWrap}>
                      <Text style={[styles.metricNumber, { color: '#D97706' }]}>{pendingCount}</Text>
                      <Text style={[styles.metricLabel, { color: '#D97706' }]}>PENDING</Text>
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
              ) : (
                <View style={styles.metricsContainer}>
                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardTotal]}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="documents-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
                      </View>
                      <View style={styles.metricTextWrap}>
                        <Text style={styles.metricNumber}>{requests.length}</Text>
                        <Text style={styles.metricLabel}>TOTAL</Text>
                      </View>
                    </View>

                    <View style={[styles.metricCard, styles.metricCardProgress]}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="time-outline" size={18} color="#2563EB" />
                      </View>
                      <View style={styles.metricTextWrap}>
                        <Text style={[styles.metricNumber, { color: '#2563EB' }]}>{inProgressCount}</Text>
                        <Text style={[styles.metricLabel, { color: '#2563EB' }]}>IN PROGRESS</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardPending]}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
                        <Ionicons name="hourglass-outline" size={18} color="#D97706" />
                      </View>
                      <View style={styles.metricTextWrap}>
                        <Text style={[styles.metricNumber, { color: '#D97706' }]}>{pendingCount}</Text>
                        <Text style={[styles.metricLabel, { color: '#D97706' }]}>PENDING</Text>
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
                </View>
              )}

              {/* Quick Preset Shortcuts */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>QUICK SERVICE PRESETS</Text>
              </View>
              <View style={styles.presetsWrap}>
                {quickShortcuts.map((preset, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [styles.shortcutChip, pressed && styles.pressed]}
                    onPress={() =>
                      router.push({
                        pathname: '/user/create-request',
                        params: { initialTitle: preset.title },
                      })
                    }
                  >
                    <Ionicons name={preset.icon} size={15} color={ExecutiveTheme.colors.brandPrimary} />
                    <Text style={styles.shortcutText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Segmented Filter Control */}
              <View style={styles.filterSection}>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[styles.segmentTab, filter === 'all' && styles.activeSegmentTab]}
                    onPress={() => setFilter('all')}
                  >
                    <Text
                      style={[styles.segmentText, filter === 'all' && styles.activeSegmentText]}
                      numberOfLines={1}
                    >
                      All ({requests.length})
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.segmentTab, filter === 'active' && styles.activeSegmentTab]}
                    onPress={() => setFilter('active')}
                  >
                    <Text
                      style={[styles.segmentText, filter === 'active' && styles.activeSegmentText]}
                      numberOfLines={1}
                    >
                      Active ({inProgressCount + pendingCount})
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
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
                <Text style={styles.loadingText}>Syncing maintenance orders...</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="document-text-outline" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>No Maintenance Orders</Text>
                <Text style={styles.emptySub}>
                  {filter === 'all'
                    ? 'You have not submitted any maintenance requests yet.'
                    : `No ${filter} requests found in this view.`}
                </Text>
                {filter === 'all' && (
                  <Pressable
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/user/create-request')}
                  >
                    <Text style={styles.emptyActionBtnText}>＋ Submit First Request</Text>
                  </Pressable>
                )}
              </View>
            )
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
              {/* Card Top Row: Badges & Date */}
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

              {/* Title & Description */}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>

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

              {/* Card Footer: Assignee & Action */}
              <View style={styles.cardFooter}>
                <View style={styles.assigneeRow}>
                  <Ionicons name="construct-outline" size={14} color={ExecutiveTheme.colors.textSecondary} />
                  <Text style={styles.assigneeName} numberOfLines={1}>
                    {item.assignee?.full_name || 'Awaiting Technician'}
                  </Text>
                </View>
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetailText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={14} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>

      {/* 4-Tab Bottom Navigation with Vector Icons */}
      <AppBottomNav activeTab="home" role="user" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  // Top Header Bar Wrapper with max-width centering
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
    elevation: 2,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userTextGroup: {
    flex: 1,
    justifyContent: 'center',
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
  newHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  newHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Main Feed Wrapper with max-width centering
  mainFeedWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  dashboardHeader: {
    paddingTop: 14,
  },
  metricsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricPairRow: {
    flexDirection: 'row',
    gap: 10,
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
    minHeight: 68,
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  metricCardTotal: {
    backgroundColor: '#FFFFFF',
  },
  metricCardProgress: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  metricCardPending: {
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
  // Quick Presets
  sectionHeaderWrap: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
  },
  presetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  shortcutsScrollContent: {
    gap: 8,
    paddingBottom: 14,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    minHeight: 42,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 1,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  // Filter Tabs
  filterSection: {
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    minHeight: 44,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    minHeight: 38,
  },
  activeSegmentTab: {
    backgroundColor: ExecutiveTheme.colors.surface,
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
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
  // Request Cards List (Bounded to maxWidth: 680)
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
    gap: 12,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
  },
  requestCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
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
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  assigneeName: {
    fontSize: 12,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 40,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.brandLight,
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  // Empty & Loading States
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
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 11,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
