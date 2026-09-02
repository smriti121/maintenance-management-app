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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

export default function StaffWorkQueueScreen() {
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'in_progress' | 'on_hold' | 'urgent'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Electrical' | 'Plumbing' | 'HVAC' | 'General'>('all');

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
      console.error('Error loading staff work queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();

      const channel = supabase
        .channel('staff_work_queue_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_requests' },
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

  // Filter only active / open tasks by default
  const activeTasks = tasks.filter((t) =>
    ['assigned', 'in_progress', 'on_hold', 'pending'].includes(t.status || 'pending')
  );

  const filteredTasks = activeTasks.filter((task) => {
    // 1. Status Filter
    if (statusFilter === 'assigned') {
      if (task.status !== 'assigned' && task.status !== 'pending') return false;
    } else if (statusFilter === 'in_progress') {
      if (task.status !== 'in_progress') return false;
    } else if (statusFilter === 'on_hold') {
      if (task.status !== 'on_hold') return false;
    } else if (statusFilter === 'urgent') {
      if (task.priority !== 'urgent' && task.priority !== 'high') return false;
    }

    // 2. Category Filter
    if (categoryFilter !== 'all') {
      const text = `${task.title} ${task.description}`.toLowerCase();
      if (categoryFilter === 'Electrical') {
        if (!text.includes('fan') && !text.includes('light') && !text.includes('switch') && !text.includes('power') && !text.includes('bulb') && !text.includes('electric')) return false;
      } else if (categoryFilter === 'Plumbing') {
        if (!text.includes('leak') && !text.includes('water') && !text.includes('tap') && !text.includes('pipe') && !text.includes('sink') && !text.includes('toilet') && !text.includes('drain')) return false;
      } else if (categoryFilter === 'HVAC') {
        if (!text.includes('ac') && !text.includes('cooling') && !text.includes('air') && !text.includes('chiller') && !text.includes('hvac')) return false;
      }
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchResident = (task.requester?.full_name || task.requester?.email || '').toLowerCase().includes(q);
      const matchRef = (task.id || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchResident && !matchRef) return false;
    }

    return true;
  });

  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? 10 : Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 10) + 4;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top Header App Bar */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBadge}>
              <Ionicons name="construct" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t('workQueue.headerTitle', 'Staff Work Queue')}</Text>
              <Text style={styles.headerSubtitle}>
                {filteredTasks.length} {t('workQueue.headerSubtitle', 'active order(s) requiring attention')}
              </Text>
            </View>
          </View>

          <View style={styles.headerRightGroup}>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>{t('workQueue.liveQueue', 'Live Queue')}</Text>
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

      {/* Main Feed Container */}
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
            <View style={styles.controlsHeader}>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={ExecutiveTheme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('workQueue.searchPlaceholder', 'Search by issue title, resident, or REF #')}
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

              {/* Status Filter Chips */}
              <View style={styles.filterChipRow}>
                {[
                  { id: 'all', label: `${t('workQueue.allActive', 'All Active')} (${activeTasks.length})` },
                  { id: 'in_progress', label: t('status.in_progress', 'In Progress') },
                  { id: 'assigned', label: t('status.assigned', 'Assigned') },
                  { id: 'on_hold', label: t('status.on_hold', 'On Hold') },
                  { id: 'urgent', label: `🚨 ${t('priority.emergency', 'Urgent')}` },
                ].map((chip) => {
                  const isActive = statusFilter === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setStatusFilter(chip.id as any)}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Category Filter Chips */}
              <View style={styles.categoryChipRow}>
                {[
                  { id: 'all', label: t('workQueue.allCategories', 'All Categories') },
                  { id: 'Electrical', label: t('categories.electrical', 'Electrical') },
                  { id: 'Plumbing', label: t('categories.plumbing', 'Plumbing') },
                  { id: 'HVAC', label: t('categories.hvac', 'HVAC') },
                  { id: 'General', label: t('categories.general', 'General') },
                ].map((cat) => {
                  const isActive = categoryFilter === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      style={[styles.catChip, isActive && styles.catChipActive]}
                      onPress={() => setCategoryFilter(cat.id as any)}
                    >
                      <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
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
                  <Ionicons name="search" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>{t('workQueue.emptyTitle', 'No Matching Work Orders')}</Text>
                <Text style={styles.emptySub}>
                  {t('workQueue.emptySub', 'No tasks found matching your filter criteria.')}
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

      <AppBottomNav activeTab="tasks" isStaff={true} />
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
  controlsHeader: {
    paddingTop: 14,
    marginBottom: 10,
    gap: 10,
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
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  catChipActive: {
    backgroundColor: '#2B2B2B',
    borderColor: '#F5C400',
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  catChipTextActive: {
    color: '#F5C400',
    fontWeight: '700',
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
    shadowOpacity: 0.2,
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
