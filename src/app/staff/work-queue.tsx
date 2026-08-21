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
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

export default function StaffWorkQueueScreen() {
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top Header App Bar */}
      <View style={styles.headerWrapper}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarBadge}>
              <Ionicons name="construct" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Staff Work Queue</Text>
              <Text style={styles.headerSubtitle}>
                {filteredTasks.length} active order(s) requiring attention
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Main Feed Container */}
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
            <View style={styles.controlsHeader}>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={ExecutiveTheme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by issue title, resident, or REF #"
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
                  { id: 'all', label: `All Active (${activeTasks.length})` },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'assigned', label: 'Assigned' },
                  { id: 'on_hold', label: 'On Hold' },
                  { id: 'urgent', label: '🚨 Urgent' },
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
                {['all', 'Electrical', 'Plumbing', 'HVAC', 'General'].map((cat) => {
                  const isActive = categoryFilter === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.catChip, isActive && styles.catChipActive]}
                      onPress={() => setCategoryFilter(cat as any)}
                    >
                      <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                        {cat === 'all' ? 'All Categories' : cat}
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
                <Text style={styles.loadingText}>Syncing dispatch queue...</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="checkmark-done-outline" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>Queue Clear</Text>
                <Text style={styles.emptySub}>
                  {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                    ? 'No maintenance tasks match your active filters.'
                    : 'All work orders are resolved. Great job!'}
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

      <AppBottomNav activeTab="tasks" role="maintenance_staff" />
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
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
    height: 44,
    gap: 10,
    ...ExecutiveTheme.shadows.soft,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '500',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.surface,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  filterChipActive: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderColor: ExecutiveTheme.colors.brandPrimary,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  catChipActive: {
    backgroundColor: ExecutiveTheme.colors.brandLight,
    borderColor: ExecutiveTheme.colors.accentGoldBorder,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  catChipTextActive: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '700',
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
    ...ExecutiveTheme.shadows.card,
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
