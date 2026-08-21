import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { ExecutiveHeader } from '@/components/executive-header';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme, formatINR } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

export default function StaffReportsScreen() {
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
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
        setStaffProfile(profile as Profile);
      }

      const data = await MaintenanceService.getStaffRequests(user.id);
      setTasks(data);
    } catch (err) {
      console.error('Staff reports error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalAssigned = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const onHoldCount = tasks.filter((t) => t.status === 'on_hold').length;
  const pendingCount = tasks.filter((t) => t.status === 'assigned' || t.status === 'pending').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completedCount = completedTasks.length;
  const completionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  // Compute Total Logged Labor Minutes
  const totalLaborMinutes = tasks.reduce((sum, t) => {
    const taskMins = (t.time_logs || []).reduce((acc, log) => acc + (log.duration_minutes || 0), 0);
    return sum + taskMins;
  }, 0);

  const totalLaborHours = (totalLaborMinutes / 60).toFixed(1);

  // Financial aggregates in ₹ INR
  const totalIncurredCost = completedTasks.reduce((sum, t) => sum + (Number(t.actual_cost) || 0), 0);
  const avgCostPerTask = completedCount > 0 ? Math.round(totalIncurredCost / completedCount) : 0;

  // Category breakdown
  const categoryCounts = {
    Electrical: 0,
    Plumbing: 0,
    HVAC: 0,
    General: 0,
  };

  tasks.forEach((t) => {
    const text = `${t.title} ${t.description}`.toLowerCase();
    if (text.includes('fan') || text.includes('light') || text.includes('switch') || text.includes('power')) {
      categoryCounts.Electrical += 1;
    } else if (text.includes('leak') || text.includes('water') || text.includes('tap') || text.includes('pipe')) {
      categoryCounts.Plumbing += 1;
    } else if (text.includes('ac') || text.includes('cooling')) {
      categoryCounts.HVAC += 1;
    } else {
      categoryCounts.General += 1;
    }
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={ExecutiveTheme.colors.surface} />
      <ExecutiveHeader
        title="Technician Performance"
        subtitle={staffProfile?.full_name ? `${staffProfile.full_name} • Work Log` : 'Labor & Tasks Completed'}
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
      >
        <View style={styles.container}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
              <Text style={styles.loadingText}>Compiling completed tasks and labor logs...</Text>
            </View>
          ) : (
            <>
              {/* Productivity & Labor Summary */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>LABOR & PRODUCTIVITY AUDIT</Text>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <View style={styles.metricIconWrap}>
                      <Ionicons name="time-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
                    </View>
                    <Text style={styles.metricItemLabel}>Logged Labor</Text>
                    <Text style={styles.metricItemValue}>{totalLaborHours} hrs</Text>
                    <Text style={styles.metricItemSub}>{totalLaborMinutes} total mins logged</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#15803D" />
                    </View>
                    <Text style={styles.metricItemLabel}>Completed</Text>
                    <Text style={[styles.metricItemValue, { color: '#15803D' }]}>{completedCount} Tasks</Text>
                    <Text style={styles.metricItemSub}>Rate: {completionRate}%</Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Total Servicing (₹)</Text>
                    <Text style={styles.metricItemValue}>{formatINR(totalIncurredCost)}</Text>
                    <Text style={styles.metricItemSub}>Incurred repairs cost</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>Avg Cost / Job (₹)</Text>
                    <Text style={styles.metricItemValue}>{formatINR(avgCostPerTask)}</Text>
                    <Text style={styles.metricItemSub}>Per completed order</Text>
                  </View>
                </View>

                {/* Resolution Completion Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>Overall Resolution Rate</Text>
                    <Text style={styles.progressPercent}>{completionRate}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
                  </View>
                </View>
              </View>

              {/* Status Breakdown Grid */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>WORKLOAD DISPATCH STATUS</Text>
                <View style={styles.kpiRow}>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{totalAssigned}</Text>
                    <Text style={styles.kpiLabel}>Total</Text>
                  </View>
                  <View style={[styles.kpiTile, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]}>
                    <Text style={[styles.kpiNumber, { color: '#7C3AED' }]}>{inProgressCount}</Text>
                    <Text style={styles.kpiLabel}>In Progress</Text>
                  </View>
                  <View style={[styles.kpiTile, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                    <Text style={[styles.kpiNumber, { color: '#C2410C' }]}>{onHoldCount}</Text>
                    <Text style={styles.kpiLabel}>On Hold</Text>
                  </View>
                  <View style={[styles.kpiTile, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Text style={[styles.kpiNumber, { color: '#15803D' }]}>{completedCount}</Text>
                    <Text style={styles.kpiLabel}>Resolved</Text>
                  </View>
                </View>
              </View>

              {/* COMPLETED TASKS & WORK HISTORY SECTION */}
              <View style={styles.card}>
                <View style={styles.completedHeaderRow}>
                  <Text style={styles.sectionHeader}>COMPLETED TASKS & WORK LOG ({completedCount})</Text>
                </View>

                {completedTasks.length === 0 ? (
                  <View style={styles.emptyCompletedBox}>
                    <Ionicons name="hourglass-outline" size={26} color={ExecutiveTheme.colors.textMuted} />
                    <Text style={styles.emptyCompletedText}>No resolved tasks yet</Text>
                    <Text style={styles.emptyCompletedSub}>
                      When you finish a work order and sign off on completion, it will appear in your official work history log.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.completedList}>
                    {completedTasks.map((item) => {
                      const itemMins = (item.time_logs || []).reduce((acc, l) => acc + (l.duration_minutes || 0), 0);
                      return (
                        <Pressable
                          key={item.id}
                          style={({ pressed }) => [styles.completedItem, pressed && styles.itemPressed]}
                          onPress={() =>
                            router.push({
                              pathname: '/staff/task-detail',
                              params: { id: item.id },
                            })
                          }
                        >
                          <View style={styles.completedItemHeader}>
                            <View style={styles.completedTitleGroup}>
                              <Text style={styles.completedItemTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                              <Text style={styles.completedItemRef}>
                                REF: #{(item.id || '').slice(0, 8).toUpperCase()}
                              </Text>
                            </View>
                            <StatusBadge status="completed" size="small" />
                          </View>

                          <Text style={styles.completedResident}>
                            Resident: {item.requester?.full_name || item.requester?.email || 'Resident'}
                          </Text>

                          {/* Work Log Summary Row */}
                          <View style={styles.workLogSummary}>
                            <View style={styles.logChip}>
                              <Ionicons name="time-outline" size={12} color="#7C3AED" />
                              <Text style={styles.logChipText}>{itemMins > 0 ? `${itemMins} mins` : 'Completed'}</Text>
                            </View>
                            {item.actual_cost !== undefined && item.actual_cost !== null && (
                              <View style={[styles.logChip, { backgroundColor: '#F0FDF4' }]}>
                                <Text style={[styles.logChipText, { color: '#15803D', fontWeight: '800' }]}>
                                  {formatINR(Number(item.actual_cost))}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.completedDate}>
                              {item.updated_at
                                ? new Date(item.updated_at).toLocaleDateString('en-IN', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Resolved'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Trade Category Breakdown */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>TRADE & DISCIPLINE ALLOCATION</Text>
                <View style={styles.catList}>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const pct = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;
                    return (
                      <View key={cat} style={styles.catRow}>
                        <View style={styles.catTextRow}>
                          <Text style={styles.catName}>{cat}</Text>
                          <Text style={styles.catPct}>
                            {count} orders ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.catTrack}>
                          <View style={[styles.catFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Staff Bottom Nav with 4 tabs (NO New Request) */}
      <AppBottomNav activeTab="reports" role="maintenance_staff" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 36,
  },
  container: {
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    gap: 14,
  },
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    ...ExecutiveTheme.shadows.soft,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricItemValue: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandPrimary,
    marginVertical: 3,
  },
  metricItemSub: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textMuted,
  },
  progressSection: {
    paddingTop: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  progressTrack: {
    height: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 2,
  },
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyCompletedBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
  },
  emptyCompletedText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
    marginTop: 6,
    marginBottom: 2,
  },
  emptyCompletedSub: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  completedList: {
    gap: 8,
  },
  completedItem: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  itemPressed: {
    opacity: 0.8,
  },
  completedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  completedTitleGroup: {
    flex: 1,
    marginRight: 8,
  },
  completedItemTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  completedItemRef: {
    fontSize: 10,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textMuted,
    marginTop: 1,
  },
  completedResident: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginBottom: 6,
  },
  workLogSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 0.8,
    borderTopColor: ExecutiveTheme.colors.border,
  },
  logChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  logChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  completedDate: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  catList: {
    gap: 10,
  },
  catRow: {
    gap: 4,
  },
  catTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  catPct: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
  },
  catTrack: {
    height: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catFill: {
    height: '100%',
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderRadius: 3,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 10,
  },
});
