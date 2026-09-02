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
import { EquipmentQrSheetModal } from '@/components/equipment-qr-sheet-modal';
import { QrScannerModal } from '@/components/qr-scanner-modal';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { Equipment, MaintenanceRequest, Profile } from '@/types/maintenance';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserDashboard() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [assetSheetVisible, setAssetSheetVisible] = useState(false);
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
    { label: t('userDashboard.presets.fanIssue', 'Fan Issue'), icon: 'sync-outline' as const, title: t('userDashboard.presets.fanIssueTitle', 'Ceiling Fan Not Working') },
    { label: t('userDashboard.presets.bulbLight', 'Bulb / Light'), icon: 'bulb-outline' as const, title: t('userDashboard.presets.bulbLightTitle', 'Bulb / Light Replacement') },
    { label: t('userDashboard.presets.acService', 'AC Service'), icon: 'snow-outline' as const, title: t('userDashboard.presets.acServiceTitle', 'Air Conditioner Cooling Malfunction') },
    { label: t('userDashboard.presets.plumbing', 'Plumbing'), icon: 'water-outline' as const, title: t('userDashboard.presets.plumbingTitle', 'Water Pipe / Tap Leakage') },
    { label: t('userDashboard.presets.electrical', 'Electrical'), icon: 'flash-outline' as const, title: t('userDashboard.presets.electricalTitle', 'Electrical Switch / Socket Spark') },
  ];

  function handleEquipmentScanned(eq: Equipment) {
    router.push({
      pathname: '/user/create-request',
      params: { productId: eq.product_id },
    });
  }

  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? 10 : Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 10) + 4;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={ExecutiveTheme.colors.surface} />

      {/* Top Header App Bar (Centered & Responsive) */}
      <View style={[styles.headerWrapper, { paddingTop: topPadding }]}>
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
                {userProfile?.full_name || t('userDashboard.greetingFallback', 'Resident Portal')}
              </Text>
              <Text style={styles.unitText} numberOfLines={1}>
                {t('userDashboard.verifiedResident', 'Apartment Resident • Verified')}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.newHeaderBtn, pressed && styles.pressed]}
            onPress={() => router.push('/user/create-request')}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.newHeaderBtnText}>{t('userDashboard.newRequestBtn', 'New Request')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Centered Scrollable Main Content Container */}
      <View style={styles.mainFeedWrapper}>
        <FlatList
          style={styles.flatList}
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
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="documents-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{requests.length}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('userDashboard.totalRequests', 'TOTAL')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardProgress]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="time-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{inProgressCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('userDashboard.inProgressRequests', 'IN PROGRESS')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardPending]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="hourglass-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{pendingCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('userDashboard.pendingRequests', 'PENDING')}
                    </Text>
                  </View>

                  <View style={[styles.metricCard, styles.metricCardSuccess]}>
                    <View style={styles.metricTopRow}>
                      <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                        <Ionicons name="checkmark-circle-outline" size={15} color="#F5C400" />
                      </View>
                      <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                    </View>
                    <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                      {t('userDashboard.resolvedRequests', 'RESOLVED')}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.metricsContainer}>
                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardTotal]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="documents-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{requests.length}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('userDashboard.totalRequests', 'TOTAL')}
                      </Text>
                    </View>

                    <View style={[styles.metricCard, styles.metricCardProgress]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="time-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{inProgressCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('userDashboard.inProgressRequests', 'IN PROGRESS')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricPairRow}>
                    <View style={[styles.metricCard, styles.metricCardPending]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="hourglass-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{pendingCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('userDashboard.pendingRequests', 'PENDING')}
                      </Text>
                    </View>

                    <View style={[styles.metricCard, styles.metricCardSuccess]}>
                      <View style={styles.metricTopRow}>
                        <View style={[styles.metricIconWrap, { backgroundColor: '#202020' }]}>
                          <Ionicons name="checkmark-circle-outline" size={15} color="#F5C400" />
                        </View>
                        <Text style={[styles.metricNumber, { color: '#F5C400' }]}>{completedCount}</Text>
                      </View>
                      <Text style={[styles.metricLabel, { color: '#F5C400' }]}>
                        {t('userDashboard.resolvedRequests', 'RESOLVED')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* QR Equipment Scanner Hero Banner */}
              <Pressable
                style={({ pressed }) => [styles.qrHeroBanner, pressed && styles.pressed]}
                onPress={() => setScannerVisible(true)}
              >
                <View style={styles.qrHeroIconBox}>
                  <Ionicons name="qr-code" size={22} color="#111111" />
                </View>
                <View style={styles.qrHeroTextBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.qrHeroTitle}>{t('equipment.scanBannerTitle', 'Fast Ticket with QR Code')}</Text>
                    <View style={styles.qrFastPill}>
                      <Text style={styles.qrFastPillText}>INSTANT</Text>
                    </View>
                  </View>
                  <Text style={styles.qrHeroSub}>
                    {t('equipment.scanBannerSub', 'Scan the QR tag on your fan, AC, or tap to auto-fill asset details')}
                  </Text>
                </View>
                <View style={styles.qrHeroCameraBtn}>
                  <Ionicons name="camera" size={16} color="#F5C400" />
                </View>
              </Pressable>

              {/* Quick Preset Shortcuts */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>{t('userDashboard.quickPresetsTitle', 'QUICK SERVICE PRESETS')}</Text>
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

              {/* Filter Chips matching Work Queue & Staff Dashboard */}
              <View style={styles.filterChipRow}>
                <Pressable
                  style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
                  onPress={() => setFilter('all')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}
                  >
                    {t('userDashboard.filterAll', 'All')} ({requests.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.filterChip, filter === 'active' && styles.filterChipActive]}
                  onPress={() => setFilter('active')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'active' && styles.filterChipTextActive]}
                  >
                    {t('userDashboard.filterActive', 'Active')} ({inProgressCount + pendingCount})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
                  onPress={() => setFilter('completed')}
                >
                  <Text
                    style={[styles.filterChipText, filter === 'completed' && styles.filterChipTextActive]}
                  >
                    {t('userDashboard.filterResolved', 'Resolved')} ({completedCount})
                  </Text>
                </Pressable>
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
                  <Ionicons name="document-text-outline" size={28} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
                <Text style={styles.emptyTitle}>{t('userDashboard.emptyTitle', 'No Maintenance Requests')}</Text>
                <Text style={styles.emptySub}>
                  {t('userDashboard.emptySubtitle', "You haven't filed any facility tickets yet. Click below to submit your first request!")}
                </Text>
                {filter === 'all' && (
                  <Pressable
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/user/create-request')}
                  >
                    <Text style={styles.emptyActionBtnText}>{t('userDashboard.createFirstRequest', '+ File First Request')}</Text>
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
                    : t('common.today', 'Today')}
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
                    {item.assignee?.full_name ? `${t('userDashboard.assignedTo', 'Assigned to')}: ${item.assignee.full_name}` : t('userDashboard.unassigned', 'Awaiting Staff Dispatch')}
                  </Text>
                </View>
                <View style={styles.viewDetailsRow}>
                  <Text style={styles.viewDetailText}>{t('common.viewDetails', 'View Details')}</Text>
                  <Ionicons name="chevron-forward" size={14} color={ExecutiveTheme.colors.brandPrimary} />
                </View>
              </View>
            </Pressable>
          )}
        />
      </View>

      {/* 4-Tab Bottom Navigation with Vector Icons */}
      <AppBottomNav activeTab="home" role="user" />

      {/* QR Scanner Modal */}
      <QrScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanSuccess={handleEquipmentScanned}
        onOpenAssetDirectory={() => setAssetSheetVisible(true)}
      />

      {/* Printable QR Asset Tag Sheet Modal */}
      <EquipmentQrSheetModal
        visible={assetSheetVisible}
        onClose={() => setAssetSheetVisible(false)}
        onSelectEquipment={handleEquipmentScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  qrHeroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    gap: 10,
    marginBottom: 10,
  },
  qrHeroIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHeroTextBox: {
    flex: 1,
  },
  qrHeroTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  qrFastPill: {
    backgroundColor: '#202020',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  qrFastPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F5C400',
    letterSpacing: 0.4,
  },
  qrHeroSub: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1.5,
    lineHeight: 14,
  },
  qrHeroCameraBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  // Top Header Bar Wrapper with max-width centering
  headerWrapper: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.borderSubtle,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 0,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    minHeight: 44,
  },
  userInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#F5C400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F5C400',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  userTextGroup: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  unitText: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  newHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  newHeaderBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
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
    backgroundColor: '#262626',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: 'center',
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricCardTotal: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardProgress: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardPending: {
    backgroundColor: '#262626',
    borderColor: '#333333',
  },
  metricCardSuccess: {
    backgroundColor: '#2B2B2B',
    borderColor: '#F5C400',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#888888',
    letterSpacing: 0.5,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
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
  requestCard: {
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
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12.5,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
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
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  assigneeName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  viewDetailText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F5C400',
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
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
