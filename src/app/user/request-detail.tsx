import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EquipmentTagCard } from '@/components/equipment-tag-card';
import { ExecutiveHeader } from '@/components/executive-header';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { TimelineView } from '@/components/timeline-view';
import { ExecutiveTheme, formatINR } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { MaintenanceService } from '@/services/maintenance-service';
import { PdfService } from '@/services/pdf-service';
import { MaintenanceRequest } from '@/types/maintenance';
import { showAlert } from '@/utils/alert';

export default function UserRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setTask] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    async function loadRequest() {
      if (!id) return;
      try {
        const data = await MaintenanceService.getRequestById(id);
        setTask(data);
      } catch (err: any) {
        console.error('Error loading request detail:', err);
        showAlert(t('requestDetail.alerts.errorTitle', 'Error'), err?.message || 'Could not load maintenance request.');
      } finally {
        setLoading(false);
      }
    }

    loadRequest();

    if (!id) return;

    const channel = supabase
      .channel(`user_request_detail_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_requests', filter: `id=eq.${id}` },
        () => loadRequest()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_request_photos', filter: `request_id=eq.${id}` },
        () => loadRequest()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_timeline_logs', filter: `request_id=eq.${id}` },
        () => loadRequest()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function handleExportPdf() {
    if (!request) return;
    setPdfGenerating(true);
    try {
      await PdfService.exportPdfReport(request);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      showAlert(t('requestDetail.alerts.pdfFailedTitle', 'PDF Export Failed'), err?.message || 'Could not generate PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ExecutiveHeader title={t('requestDetail.headerTitle', 'Work Order Details')} showBack={true} fallbackRoute="/user/dashboard" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
          <Text style={styles.loadingText}>{t('requestDetail.loadingDetail', 'Loading work order details...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.screen}>
        <ExecutiveHeader title={t('requestDetail.headerTitle', 'Work Order Details')} showBack={true} fallbackRoute="/user/dashboard" />
        <View style={styles.centerContainer}>
          <Text style={styles.notFoundText}>{t('requestDetail.orderNotFound', 'Work order record not found.')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const issuePhotos = (request.photos || []).filter(
    (p) => !p.photo_type || p.photo_type === 'issue' || p.photo_type === 'before'
  );
  const resolutionPhotos = (request.photos || []).filter(
    (p) => p.photo_type === 'after' || p.photo_type === 'completion'
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ExecutiveHeader
        title={t('requestDetail.headerTitle', 'Work Order Details')}
        subtitle={`Ref: #${(request.id || '').slice(0, 8).toUpperCase()}`}
        showBack={true}
        fallbackRoute="/user/dashboard"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.pdfTopBtn, pressed && styles.pressed]}
            onPress={handleExportPdf}
            disabled={pdfGenerating}
          >
            {pdfGenerating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.pdfTopBtnText}>{t('requestDetail.exportPdfBtn', '📄 PDF Report')}</Text>
            )}
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Section 1: Overview & Status */}
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <StatusBadge status={request.status || 'pending'} size="medium" />
              <PriorityBadge priority={request.priority || 'medium'} size="medium" />
            </View>

            <Text style={styles.title}>{request.title}</Text>
            <Text style={styles.description}>{request.description}</Text>

            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>{t('requestDetail.submittedOn', 'SUBMITTED ON:')}</Text>
              <Text style={styles.dateValue}>
                {request.created_at
                  ? new Date(request.created_at).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Today'}
              </Text>
            </View>
          </View>

          {/* Equipment Asset Information (if linked) */}
          {request.equipment && (
            <EquipmentTagCard equipment={request.equipment} readOnly={true} />
          )}

          {/* Section 2: Assigned Staff / Technician */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>{t('requestDetail.specialistTitle', 'ASSIGNED MAINTENANCE SPECIALIST')}</Text>
            {request.assignee ? (
              <View style={styles.staffRow}>
                <View style={styles.staffAvatar}>
                  <Text style={styles.staffAvatarText}>
                    {request.assignee.full_name
                      ? request.assignee.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : 'TC'}
                  </Text>
                </View>
                <View style={styles.staffInfo}>
                  <Text style={styles.staffName}>{request.assignee.full_name || 'Assigned Staff'}</Text>
                  <Text style={styles.staffRole}>Certified Technician • Facilities Desk</Text>
                  <Text style={styles.staffEmail}>{request.assignee.email || ''}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedBox}>
                <Text style={styles.unassignedText}>
                  {t('requestDetail.unassignedNotice', '⏳ Request logged in dispatch queue. Technician assignment in progress.')}
                </Text>
              </View>
            )}
          </View>

          {/* Section 3: Financial & Warranty Summary (in ₹ INR) */}
          {(request.actual_cost != null || request.estimated_cost != null || request.warranty_status) && (
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>{t('requestDetail.financialTitle', 'FINANCIAL & WARRANTY SUMMARY (₹ INR)')}</Text>
              <View style={styles.financeGrid}>
                {request.estimated_cost != null && (
                  <View style={styles.financeBox}>
                    <Text style={styles.financeLabel}>{t('requestDetail.estimatedQuote', 'Estimated Quote')}</Text>
                    <Text style={styles.financeVal}>{formatINR(request.estimated_cost)}</Text>
                  </View>
                )}
                {request.actual_cost != null && (
                  <View style={[styles.financeBox, { backgroundColor: '#202020', borderColor: '#2B2B2B' }]}>
                    <Text style={[styles.financeLabel, { color: '#E5E5E5' }]}>{t('requestDetail.finalCost', 'Final Actual Cost')}</Text>
                    <Text style={[styles.financeVal, { color: '#F5C400' }]}>
                      {formatINR(request.actual_cost)}
                    </Text>
                  </View>
                )}
              </View>

              {request.warranty_status && (
                <View style={styles.warrantyRow}>
                  <Text style={styles.warrantyLabel}>{t('requestDetail.warrantyStatus', 'Warranty Status:')}</Text>
                  <Text style={styles.warrantyValue}>
                    {request.warranty_status.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </View>
              )}

              {request.replacement_details && (
                <View style={styles.replacementBox}>
                  <Text style={styles.replacementLabel}>🔧 Replaced Hardware / Service Notes:</Text>
                  <Text style={styles.replacementText}>{request.replacement_details}</Text>
                </View>
              )}

              {request.completion_summary && (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>📋 Verified Technical Completion Summary:</Text>
                  <Text style={styles.summaryText}>{request.completion_summary}</Text>
                </View>
              )}
            </View>
          )}

          {/* Section 4: Photo Gallery */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>{t('requestDetail.photosTitle', 'WORK ORDER EVIDENCE & PHOTOS')}</Text>

            {/* Issue Photos */}
            <Text style={styles.photoSubHeader}>{t('requestDetail.initialPhotos', 'Initial Problem Photos')} ({issuePhotos.length})</Text>
            {issuePhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {issuePhotos.map((p, idx) => (
                  <Pressable key={p.id || idx} onPress={() => setSelectedPhotoUrl(p.url || null)}>
                    <Image source={{ uri: p.url }} style={styles.photoThumb} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyPhotoText}>No initial photos attached.</Text>
            )}

            {/* Resolution Photos */}
            {resolutionPhotos.length > 0 && (
              <>
                <Text style={[styles.photoSubHeader, { color: '#F5C400', marginTop: 12 }]}>
                  Verified Post-Repair Photos ({resolutionPhotos.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {resolutionPhotos.map((p, idx) => (
                    <Pressable key={p.id || idx} onPress={() => setSelectedPhotoUrl(p.url || null)}>
                      <Image source={{ uri: p.url }} style={styles.photoThumb} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* Section 5: Timeline & Activity Logs */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>PROGRESS TIMELINE & AUDIT TRAIL</Text>
            <TimelineView logs={request.timeline_logs || []} />
          </View>
        </View>
      </ScrollView>

      {/* Fullscreen Photo Viewer Modal */}
      <Modal visible={!!selectedPhotoUrl} transparent animationType="fade">
        <View style={styles.fullscreenModal}>
          <Pressable style={styles.closeModalBtn} onPress={() => setSelectedPhotoUrl(null)}>
            <Text style={styles.closeModalText}>✕ Close</Text>
          </Pressable>
          {selectedPhotoUrl && (
            <Image
              source={{ uri: selectedPhotoUrl }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  container: {
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    gap: 14,
  },
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 0.8,
    borderTopColor: ExecutiveTheme.colors.borderSubtle,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textMuted,
    letterSpacing: 0.4,
  },
  dateValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  staffAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#60A5FA',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  staffRole: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  staffEmail: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textMuted,
  },
  unassignedBox: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  unassignedText: {
    fontSize: 12.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontStyle: 'italic',
  },
  financeGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  financeBox: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  financeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  financeVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F5C400',
    marginTop: 2,
  },
  warrantyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  warrantyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
  },
  warrantyValue: {
    fontSize: 12,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  replacementBox: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  replacementLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginBottom: 2,
  },
  replacementText: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 16,
  },
  summaryBox: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 0.8,
    borderColor: ExecutiveTheme.colors.border,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginBottom: 2,
  },
  summaryText: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 16,
  },
  photoSubHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    marginBottom: 6,
  },
  photoScroll: {
    marginTop: 4,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  emptyPhotoText: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textMuted,
    fontStyle: 'italic',
  },
  pdfTopBtn: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pdfTopBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#111111',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 10,
  },
  notFoundText: {
    fontSize: 14,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '90%',
    height: '80%',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  closeModalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
