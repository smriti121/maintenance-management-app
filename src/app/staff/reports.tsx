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
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest, Profile } from '@/types/maintenance';

export default function StaffReportsScreen() {
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [staffProfile, setStaffProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();

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
  const totalLaborMinutes = tasks.reduce((sum, reqItem) => {
    const taskMins = (reqItem.time_logs || []).reduce((acc, log) => acc + (log.duration_minutes || 0), 0);
    return sum + taskMins;
  }, 0);

  const totalLaborHours = (totalLaborMinutes / 60).toFixed(1);

  // Financial aggregates in ₹ INR
  const totalIncurredCost = completedTasks.reduce((sum, reqItem) => sum + (Number(reqItem.actual_cost) || 0), 0);
  const avgCostPerTask = completedCount > 0 ? Math.round(totalIncurredCost / completedCount) : 0;

  // Category breakdown
  const categoryCounts = {
    [t('categories.electrical', 'Electrical')]: 0,
    [t('categories.plumbing', 'Plumbing')]: 0,
    [t('categories.hvac', 'HVAC')]: 0,
    [t('categories.general', 'General')]: 0,
  };

  tasks.forEach((reqItem) => {
    const text = `${reqItem.title} ${reqItem.description}`.toLowerCase();
    if (text.includes('fan') || text.includes('light') || text.includes('switch') || text.includes('power')) {
      categoryCounts[t('categories.electrical', 'Electrical')] += 1;
    } else if (text.includes('leak') || text.includes('water') || text.includes('tap') || text.includes('pipe')) {
      categoryCounts[t('categories.plumbing', 'Plumbing')] += 1;
    } else if (text.includes('ac') || text.includes('cooling')) {
      categoryCounts[t('categories.hvac', 'HVAC')] += 1;
    } else {
      categoryCounts[t('categories.general', 'General')] += 1;
    }
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={ExecutiveTheme.colors.surface} />
      <ExecutiveHeader
        title={t('staffReports.headerTitle', 'Technician Performance')}
        subtitle={staffProfile?.full_name ? `${staffProfile.full_name} • ${t('staffReports.workLog', 'Work Log')}` : t('staffReports.laborCompleted', 'Labor & Tasks Completed')}
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
              <Text style={styles.loadingText}>{t('staffReports.compilingTasks', 'Compiling completed tasks and labor logs...')}</Text>
            </View>
          ) : (
            <>
              {/* Productivity & Labor Summary */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('staffReports.productivityAuditTitle', 'LABOR & PRODUCTIVITY AUDIT')}</Text>
                </View>

                {/* 2x2 Metric Grid */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="time-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.metricItemLabel}>{t('staffReports.loggedLabor', 'Logged Labor')}</Text>
                    </View>
                    <Text style={styles.metricItemValue}>
                      {totalLaborHours} <Text style={styles.metricUnit}>{t('staffReports.hrsUnit', 'hrs')}</Text>
                    </Text>
                    <Text style={styles.metricItemSub}>
                      {totalLaborMinutes} {t('staffReports.totalMinsLogged', 'total mins logged')}
                    </Text>
                  </View>

                  <View style={styles.metricItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="checkmark-done-circle-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.metricItemLabel}>{t('staffReports.completed', 'Completed')}</Text>
                    </View>
                    <Text style={styles.metricItemValue}>
                      {completedCount} <Text style={styles.metricUnit}>{t('staffReports.tasksUnit', 'Tasks')}</Text>
                    </Text>
                    <Text style={styles.metricItemSub}>
                      {t('staffReports.ratePrefix', 'Rate:')} <Text style={styles.metricSubHighlight}>{completionRate}%</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="cash-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.metricItemLabel}>{t('staffReports.totalServicing', 'Total Servicing')}</Text>
                    </View>
                    <Text style={styles.metricItemValue}>{formatINR(totalIncurredCost)}</Text>
                    <Text style={styles.metricItemSub}>{t('staffReports.incurredRepairsSub', 'Incurred repairs cost')}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="calculator-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.metricItemLabel}>{t('staffReports.avgCostPerJob', 'Avg Cost / Job')}</Text>
                    </View>
                    <Text style={styles.metricItemValue}>{formatINR(avgCostPerTask)}</Text>
                    <Text style={styles.metricItemSub}>{t('staffReports.perCompletedOrderSub', 'Per completed order')}</Text>
                  </View>
                </View>

                {/* Resolution Completion Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="trending-up-outline" size={15} color="#F5C400" />
                      <Text style={styles.progressTitle}>{t('staffReports.overallResolutionRate', 'Overall Resolution Rate')}</Text>
                    </View>
                    <View style={styles.rateBadge}>
                      <Text style={styles.rateBadgeText}>{completionRate}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
                  </View>
                </View>
              </View>

              {/* Status Breakdown Grid */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('staffReports.workloadStatusTitle', 'WORKLOAD DISPATCH STATUS')}</Text>
                </View>
                <View style={styles.kpiRow}>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{totalAssigned}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1}>{t('common.all', 'All')}</Text>
                  </View>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{inProgressCount}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1}>{t('status.in_progress', 'In Progress')}</Text>
                  </View>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{onHoldCount}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1}>{t('status.on_hold', 'On Hold')}</Text>
                  </View>
                  <View style={[styles.kpiTile, styles.kpiTileHighlight]}>
                    <Text style={[styles.kpiNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                    <Text style={[styles.kpiLabel, { color: '#F5C400' }]} numberOfLines={1}>{t('status.completed', 'Resolved')}</Text>
                  </View>
                </View>
              </View>

              {/* COMPLETED TASKS & WORK HISTORY SECTION */}
              <View style={styles.card}>
                <View style={styles.completedHeaderRow}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderAccent} />
                    <Text style={styles.sectionHeader}>
                      {t('staffReports.completedTasksHistoryTitle', 'COMPLETED TASKS & WORK LOG')}
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{completedCount}</Text>
                  </View>
                </View>

                {completedTasks.length === 0 ? (
                  <View style={styles.emptyCompletedBox}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="document-text-outline" size={24} color="#F5C400" />
                    </View>
                    <Text style={styles.emptyCompletedText}>{t('staffReports.noResolvedTasksYet', 'No resolved tasks yet')}</Text>
                    <Text style={styles.emptyCompletedSub}>
                      {t('staffReports.noResolvedTasksSub', 'When you finish a work order and sign off on completion, it will appear in your official work history log.')}
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
                              <View style={styles.refPill}>
                                <Text style={styles.completedItemRef}>
                                  #{(item.id || '').slice(0, 8).toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            <StatusBadge status="completed" size="small" />
                          </View>

                          <View style={styles.residentRow}>
                            <Ionicons name="person-outline" size={13} color="#888888" />
                            <Text style={styles.completedResident} numberOfLines={1}>
                              {item.requester?.full_name || item.requester?.email || t('staffDashboard.residentLabel', 'Resident')}
                            </Text>
                          </View>

                          {/* Work Log Summary Row */}
                          <View style={styles.workLogSummary}>
                            <View style={styles.logChip}>
                              <Ionicons name="time-outline" size={12} color="#F5C400" />
                              <Text style={styles.logChipText}>
                                {itemMins > 0 ? `${itemMins} mins` : t('status.completed', 'Completed')}
                              </Text>
                            </View>
                            {item.actual_cost !== undefined && item.actual_cost !== null && (
                              <View style={styles.costChip}>
                                <Ionicons name="cash-outline" size={12} color="#F5C400" />
                                <Text style={styles.costChipText}>
                                  {formatINR(Number(item.actual_cost))}
                                </Text>
                              </View>
                            )}
                            <View style={styles.dateContainer}>
                              <Ionicons name="calendar-outline" size={11} color="#888888" />
                              <Text style={styles.completedDate}>
                                {item.updated_at
                                  ? new Date(item.updated_at).toLocaleDateString('en-IN', {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : t('status.completed', 'Resolved')}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Trade Category Breakdown */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('staffReports.tradeAllocationTitle', 'TRADE & DISCIPLINE ALLOCATION')}</Text>
                </View>
                <View style={styles.catList}>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const pct = totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0;
                    return (
                      <View key={cat} style={styles.catRow}>
                        <View style={styles.catTextRow}>
                          <Text style={styles.catName}>{cat}</Text>
                          <Text style={styles.catPct}>
                            {count} {t('staffReports.ordersCount', 'orders')} ({pct}%)
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

      <AppBottomNav activeTab="reports" isStaff={true} />
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
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  metricItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricItemValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  metricUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5E5E5',
  },
  metricItemSub: {
    fontSize: 10.5,
    color: '#888888',
    marginTop: 2,
  },
  metricSubHighlight: {
    color: '#F5C400',
    fontWeight: '800',
  },
  progressSection: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5E5E5',
  },
  rateBadge: {
    backgroundColor: '#F5C400',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rateBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#111111',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F5C400',
    borderRadius: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  kpiTileHighlight: {
    borderColor: '#F5C400',
    backgroundColor: '#2B2B2B',
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#888888',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  completedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countBadge: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F5C400',
    marginBottom: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5C400',
  },
  emptyCompletedBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#262626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyCompletedText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  emptyCompletedSub: {
    fontSize: 11.5,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 16,
  },
  completedList: {
    gap: 10,
  },
  completedItem: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#333333',
  },
  itemPressed: {
    opacity: 0.82,
  },
  completedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  completedTitleGroup: {
    flex: 1,
    marginRight: 8,
    gap: 3,
  },
  completedItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  refPill: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    alignSelf: 'flex-start',
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  completedItemRef: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F5C400',
    letterSpacing: 0.3,
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  completedResident: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '500',
  },
  workLogSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 0.8,
    borderTopColor: '#333333',
  },
  logChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  logChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E5E5E5',
  },
  costChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  costChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5C400',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  completedDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
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
    color: '#FFFFFF',
  },
  catPct: {
    fontSize: 11.5,
    color: '#888888',
    fontWeight: '600',
  },
  catTrack: {
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  catFill: {
    height: '100%',
    backgroundColor: '#F5C400',
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
