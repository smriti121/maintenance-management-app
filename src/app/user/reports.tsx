import { Ionicons } from '@expo/vector-icons';
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
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { MaintenanceRequest } from '@/types/maintenance';

export default function UserReportsScreen() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();

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
    [t('categories.plumbing', 'Plumbing')]: 0,
    [t('categories.electrical', 'Electrical')]: 0,
    [t('categories.hvac', 'HVAC')]: 0,
    [t('categories.general', 'General')]: 0,
  };

  requests.forEach((r) => {
    const text = `${r.title} ${r.description}`.toLowerCase();
    if (text.includes('leak') || text.includes('water') || text.includes('tap') || text.includes('pipe')) {
      categoryCounts[t('categories.plumbing', 'Plumbing')] += 1;
    } else if (text.includes('fan') || text.includes('light') || text.includes('switch') || text.includes('power') || text.includes('bulb')) {
      categoryCounts[t('categories.electrical', 'Electrical')] += 1;
    } else if (text.includes('ac') || text.includes('cooling') || text.includes('heater')) {
      categoryCounts[t('categories.hvac', 'HVAC')] += 1;
    } else {
      categoryCounts[t('categories.general', 'General')] += 1;
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
        title={t('userReports.headerTitle', 'Maintenance Analytics & Reports')}
        subtitle={t('userReports.headerSubtitle', 'Facility Performance & Financial Audit')}
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
              <ActivityIndicator size="large" color="#F5C400" />
              <Text style={styles.loadingText}>{t('userReports.generatingReport', 'Generating facility report...')}</Text>
            </View>
          ) : (
            <>
              {/* Financial Overview Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('userReports.financialSummaryTitle', 'FINANCIAL EXPENDITURE SUMMARY (₹ INR)')}</Text>
                </View>

                <View style={styles.financeGrid}>
                  <View style={styles.financeItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="wallet-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.financeLabel}>{t('userReports.totalIncurredCost', 'Total Incurred Cost')}</Text>
                    </View>
                    <Text style={styles.financeValueLarge}>{formatINR(totalCost)}</Text>
                    <Text style={styles.financeSub}>{t('userReports.verifiedInvoicesSub', 'Based on verified repair invoices')}</Text>
                  </View>

                  <View style={styles.financeItem}>
                    <View style={styles.metricItemHeader}>
                      <View style={styles.metricIconWrap}>
                        <Ionicons name="calculator-outline" size={16} color="#F5C400" />
                      </View>
                      <Text style={styles.financeLabel}>{t('userReports.avgRepairCost', 'Avg Repair Cost')}</Text>
                    </View>
                    <Text style={styles.financeValue}>{formatINR(avgCost)}</Text>
                    <Text style={styles.financeSub}>{t('userReports.perCompletedOrderSub', 'Per completed work order')}</Text>
                  </View>
                </View>

                <View style={styles.estimatedRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="receipt-outline" size={14} color="#888888" />
                    <Text style={styles.estimatedLabel}>{t('userReports.estimatedTotalQuotes', 'Estimated Total Quotes:')}</Text>
                  </View>
                  <View style={styles.estimatedPill}>
                    <Text style={styles.estimatedValue}>{formatINR(totalEstimatedCost)}</Text>
                  </View>
                </View>
              </View>

              {/* Work Order KPI Tiles */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('userReports.workOrderPerformanceTitle', 'WORK ORDER PERFORMANCE')}</Text>
                </View>

                <View style={styles.kpiRow}>
                  <View style={styles.kpiTile}>
                    <View style={styles.kpiIconWrap}>
                      <Ionicons name="documents-outline" size={14} color="#F5C400" />
                    </View>
                    <Text style={styles.kpiNumber}>{totalCount}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('userReports.totalRequests', 'Total Logged')}</Text>
                  </View>

                  <View style={styles.kpiTile}>
                    <View style={styles.kpiIconWrap}>
                      <Ionicons name="time-outline" size={14} color="#F5C400" />
                    </View>
                    <Text style={styles.kpiNumber}>{inProgressCount}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('userReports.inProgress', 'In Progress')}</Text>
                  </View>

                  <View style={styles.kpiTile}>
                    <View style={styles.kpiIconWrap}>
                      <Ionicons name="hourglass-outline" size={14} color="#F5C400" />
                    </View>
                    <Text style={styles.kpiNumber}>{pendingCount}</Text>
                    <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('userReports.pending', 'Pending')}</Text>
                  </View>

                  <View style={[styles.kpiTile, styles.kpiTileHighlight]}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: '#2B2B2B', borderColor: '#F5C400' }]}>
                      <Ionicons name="checkmark-circle-outline" size={14} color="#F5C400" />
                    </View>
                    <Text style={[styles.kpiNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                    <Text style={[styles.kpiLabel, { color: '#F5C400' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('userReports.resolved', 'Resolved')}</Text>
                  </View>
                </View>

                {/* Resolution Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="trending-up-outline" size={15} color="#F5C400" />
                      <Text style={styles.progressTitle}>{t('userReports.resolutionRate', 'Resolution Completion Rate')}</Text>
                    </View>
                    <View style={styles.rateBadge}>
                      <Text style={styles.rateBadgeText}>{resolutionRate}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${resolutionRate}%` }]} />
                  </View>
                </View>
              </View>

              {/* Service Category Breakdown */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('userReports.categoryBreakdownTitle', 'SERVICE CATEGORY BREAKDOWN')}</Text>
                </View>

                <View style={styles.categoryList}>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                    const catLower = cat.toLowerCase();
                    const barColor = count === 0
                      ? '#333333'
                      : catLower.includes('plumb')
                      ? '#E5E5E5'
                      : '#F5C400';

                    return (
                      <View key={cat} style={styles.categoryRow}>
                        <View style={styles.catHeader}>
                          <Text style={styles.catName}>{cat}</Text>
                          <Text style={styles.catCount}>
                            {count} {t('userReports.requestsCount', 'requests')} ({pct}%)
                          </Text>
                        </View>
                        <View style={styles.catBarTrack}>
                          <View style={[styles.catBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Priority Breakdown */}
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderAccent} />
                  <Text style={styles.sectionHeader}>{t('userReports.priorityAuditTitle', 'SEVERITY & PRIORITY AUDIT')}</Text>
                </View>

                <View style={styles.priorityGrid}>
                  <View style={[styles.priorityCard, urgentCount > 0 && styles.priorityCardHighlight]}>
                    <View style={styles.priorityIconWrap}>
                      <Ionicons name="flame-outline" size={14} color={urgentCount > 0 ? '#F5C400' : '#888888'} />
                    </View>
                    <Text style={[styles.priorityCount, urgentCount > 0 && { color: '#F5C400' }]}>{urgentCount}</Text>
                    <Text style={[styles.priorityTitle, urgentCount > 0 && { color: '#E5E5E5' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('priority.emergency', 'Urgent')}</Text>
                  </View>

                  <View style={[styles.priorityCard, highCount > 0 && styles.priorityCardHighlight]}>
                    <View style={styles.priorityIconWrap}>
                      <Ionicons name="alert-circle-outline" size={14} color={highCount > 0 ? '#F5C400' : '#888888'} />
                    </View>
                    <Text style={[styles.priorityCount, highCount > 0 && { color: '#F5C400' }]}>{highCount}</Text>
                    <Text style={[styles.priorityTitle, highCount > 0 && { color: '#E5E5E5' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('priority.high', 'High')}</Text>
                  </View>

                  <View style={[styles.priorityCard, mediumCount > 0 && styles.priorityCardHighlight]}>
                    <View style={styles.priorityIconWrap}>
                      <Ionicons name="layers-outline" size={14} color={mediumCount > 0 ? '#F5C400' : '#888888'} />
                    </View>
                    <Text style={[styles.priorityCount, mediumCount > 0 && { color: '#FFFFFF' }]}>{mediumCount}</Text>
                    <Text style={[styles.priorityTitle, mediumCount > 0 && { color: '#E5E5E5' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('priority.medium', 'Standard')}</Text>
                  </View>

                  <View style={[styles.priorityCard, lowCount > 0 && styles.priorityCardHighlight]}>
                    <View style={styles.priorityIconWrap}>
                      <Ionicons name="information-circle-outline" size={14} color={lowCount > 0 ? '#F5C400' : '#888888'} />
                    </View>
                    <Text style={[styles.priorityCount, lowCount > 0 && { color: '#FFFFFF' }]}>{lowCount}</Text>
                    <Text style={[styles.priorityTitle, lowCount > 0 && { color: '#E5E5E5' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('priority.low', 'Low')}</Text>
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
  financeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  financeItem: {
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
  financeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  financeValueLarge: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  financeValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 2,
  },
  financeSub: {
    fontSize: 10.5,
    color: '#888888',
    marginTop: 2,
  },
  estimatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 0.8,
    borderTopColor: '#333333',
  },
  estimatedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  estimatedPill: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#333333',
  },
  estimatedValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F5C400',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
  kpiIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    color: '#FFFFFF',
  },
  catCount: {
    fontSize: 11.5,
    color: '#888888',
    fontWeight: '600',
  },
  catBarTrack: {
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  priorityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityCard: {
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
  priorityCardHighlight: {
    borderColor: '#4A4A4A',
    backgroundColor: '#2B2B2B',
  },
  priorityIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  priorityCount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#888888',
  },
  priorityTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#888888',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
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
