import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { ExecutiveHeader } from '@/components/executive-header';
import { ExecutiveTheme, formatINR } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest } from '@/types/maintenance';

export default function UserReportsScreen() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const data = await MaintenanceService.getUserRequests(user.id);
      setRequests(data);
    } catch (err) {
      console.error('Reports load error:', err);
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

  const totalCount = requests.length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const inProgressCount = requests.filter((r) =>
    ['assigned', 'in_progress', 'on_hold'].includes(r.status || '')
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const resolutionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Real Financial Aggregates in ₹ INR
  const totalCost = requests.reduce((sum, r) => sum + (Number(r.actual_cost) || 0), 0);
  const totalEstimatedCost = requests.reduce(
    (sum, r) => sum + (Number(r.estimated_cost) || 0),
    0
  );
  const avgCost = completedCount > 0 ? totalCost / completedCount : 0;

  // Category Distribution from Title & Description
  const categoryCounts = {
    Plumbing: 0,
    Electrical: 0,
    HVAC: 0,
    General: 0,
  };

  requests.forEach((r) => {
    const text = `${r.title} ${r.description}`.toLowerCase();
    if (text.includes('leak') || text.includes('water') || text.includes('tap') || text.includes('pipe')) {
      categoryCounts.Plumbing += 1;
    } else if (text.includes('fan') || text.includes('light') || text.includes('switch') || text.includes('power') || text.includes('bulb')) {
      categoryCounts.Electrical += 1;
    } else if (text.includes('ac') || text.includes('cooling') || text.includes('heater')) {
      categoryCounts.HVAC += 1;
    } else {
      categoryCounts.General += 1;
    }
  });

  // Priority Distribution
  const urgentCount = requests.filter((r) => r.priority === 'urgent').length;
  const highCount = requests.filter((r) => r.priority === 'high').length;
  const mediumCount = requests.filter((r) => r.priority === 'medium' || !r.priority).length;
  const lowCount = requests.filter((r) => r.priority === 'low').length;

  return (
    <SafeAreaView style={styles.screen}>
      <ExecutiveHeader
        title="Maintenance Analytics & Reports"
        subtitle="Facility Performance & Financial Audit"
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
              <Text style={styles.loadingText}>Generating facility report...</Text>
            </View>
          ) : (
            <>
              {/* Financial Overview Card */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>FINANCIAL EXPENDITURE SUMMARY (₹ INR)</Text>
                <View style={styles.financeGrid}>
                  <View style={styles.financeItem}>
                    <Text style={styles.financeLabel}>Total Incurred Cost</Text>
                    <Text style={styles.financeValueLarge}>{formatINR(totalCost)}</Text>
                    <Text style={styles.financeSub}>Based on verified repair invoices</Text>
                  </View>
                  <View style={styles.financeItem}>
                    <Text style={styles.financeLabel}>Avg Repair Cost</Text>
                    <Text style={styles.financeValue}>{formatINR(avgCost)}</Text>
                    <Text style={styles.financeSub}>Per completed work order</Text>
                  </View>
                </View>

                <View style={styles.estimatedRow}>
                  <Text style={styles.estimatedLabel}>Estimated Total Quotes:</Text>
                  <Text style={styles.estimatedValue}>{formatINR(totalEstimatedCost)}</Text>
                </View>
              </View>

              {/* Work Order KPI Tiles */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>WORK ORDER PERFORMANCE</Text>
                <View style={styles.kpiRow}>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{totalCount}</Text>
                    <Text style={styles.kpiLabel}>Total Logged</Text>
                  </View>
                  <View style={[styles.kpiTile, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <Text style={[styles.kpiNumber, { color: '#B45309' }]}>{inProgressCount}</Text>
                    <Text style={styles.kpiLabel}>In Progress</Text>
                  </View>
                  <View style={styles.kpiTile}>
                    <Text style={styles.kpiNumber}>{pendingCount}</Text>
                    <Text style={styles.kpiLabel}>Pending</Text>
                  </View>
                  <View style={[styles.kpiTile, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Text style={[styles.kpiNumber, { color: '#15803D' }]}>{completedCount}</Text>
                    <Text style={styles.kpiLabel}>Resolved</Text>
                  </View>
                </View>

                {/* Resolution Progress Bar */}
                <View style={styles.progressBarSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>Resolution Completion Rate</Text>
                    <Text style={styles.progressValue}>{resolutionRate}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${resolutionRate}%` }]} />
                  </View>
                </View>
              </View>

              {/* Service Category Breakdown */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>SERVICE CATEGORY BREAKDOWN</Text>
                <View style={styles.categoryList}>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                    return (
                      <View key={cat} style={styles.categoryRow}>
                        <View style={styles.catHeader}>
                          <Text style={styles.catName}>{cat}</Text>
                          <Text style={styles.catCount}>
                            {count} requests ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.catBarTrack}>
                          <View style={[styles.catBarFill, { width: `${pct}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Priority Breakdown */}
              <View style={styles.card}>
                <Text style={styles.sectionHeader}>SEVERITY & PRIORITY AUDIT</Text>
                <View style={styles.priorityGrid}>
                  <View style={[styles.priorityCard, { borderLeftColor: '#991B1B' }]}>
                    <Text style={styles.priorityCount}>{urgentCount}</Text>
                    <Text style={styles.priorityTitle}>Urgent Dispatch</Text>
                  </View>
                  <View style={[styles.priorityCard, { borderLeftColor: '#EA580C' }]}>
                    <Text style={styles.priorityCount}>{highCount}</Text>
                    <Text style={styles.priorityTitle}>High Priority</Text>
                  </View>
                  <View style={[styles.priorityCard, { borderLeftColor: '#D97706' }]}>
                    <Text style={styles.priorityCount}>{mediumCount}</Text>
                    <Text style={styles.priorityTitle}>Standard</Text>
                  </View>
                  <View style={[styles.priorityCard, { borderLeftColor: '#64748B' }]}>
                    <Text style={styles.priorityCount}>{lowCount}</Text>
                    <Text style={styles.priorityTitle}>Low Priority</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <AppBottomNav activeTab="reports" role="user" />
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
  financeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  financeItem: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  financeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  financeValueLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandDark,
    marginVertical: 4,
  },
  financeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandDark,
    marginVertical: 4,
  },
  financeSub: {
    fontSize: 10,
    color: ExecutiveTheme.colors.textMuted,
  },
  estimatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: ExecutiveTheme.colors.border,
  },
  estimatedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  estimatedValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.accentGold,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
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
  progressBarSection: {
    paddingTop: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  progressTrack: {
    height: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: ExecutiveTheme.colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 4,
  },
  categoryList: {
    gap: 10,
  },
  categoryRow: {
    gap: 4,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  catCount: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
  },
  catBarTrack: {
    height: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderRadius: 3,
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  priorityCount: {
    fontSize: 16,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  priorityTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 2,
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
