import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { TimelineView } from '@/components/timeline-view';
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

  useEffect(() => {
    async function loadRequest() {
      if (!id) return;
      try {
        const data = await MaintenanceService.getRequestById(id);
        setTask(data);
      } catch (err: any) {
        console.error('Error loading request detail:', err);
        showAlert('Error', err?.message || 'Could not load maintenance request.');
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
        () => {
          loadRequest();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_request_photos', filter: `request_id=eq.${id}` },
        () => {
          loadRequest();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_timeline_logs', filter: `request_id=eq.${id}` },
        () => {
          loadRequest();
        }
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
      showAlert('PDF Export Failed', err?.message || 'Could not generate PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading request details...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Request not found.</Text>
        <Pressable style={styles.navBackBtn} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </Pressable>
      </View>
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
      {/* iOS Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.navBackBtn}>
          <Text style={styles.navBackText}>‹</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Request Details</Text>
        <Pressable
          style={({ pressed }) => [styles.pdfTopBtn, pressed && styles.pressed]}
          onPress={handleExportPdf}
          disabled={pdfGenerating}
        >
          {pdfGenerating ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.pdfTopBtnText}>📄 PDF</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Section 1: Header Card */}
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <StatusBadge status={request.status || 'pending'} size="medium" />
              <PriorityBadge priority={request.priority || 'medium'} size="medium" />
            </View>

            <Text style={styles.title}>{request.title}</Text>

            <Text style={styles.metaText}>
              Submitted on{' '}
              {request.created_at
                ? new Date(request.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Today'}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionHeader}>DESCRIPTION</Text>
            <Text style={styles.descriptionText}>{request.description}</Text>
          </View>

          {/* Section 2: Assigned Staff Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>ASSIGNED TECHNICIAN</Text>
            {request.assignee ? (
              <View style={styles.assigneeBox}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(request.assignee.full_name || request.assignee.email || 'T')
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assigneeName}>
                    {request.assignee.full_name || 'Assigned Technician'}
                  </Text>
                  <Text style={styles.assigneeEmail}>{request.assignee.email}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedBox}>
                <Text style={styles.unassignedIcon}>⚡</Text>
                <Text style={styles.unassignedText}>
                  Auto-assigning to available maintenance staff...
                </Text>
              </View>
            )}
          </View>

          {/* Section 3: Photos Gallery */}
          {issuePhotos.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>
                REPORTED ISSUE PHOTOS ({issuePhotos.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {issuePhotos.map((photo, idx) => (
                  <Pressable
                    key={photo.id || idx}
                    onPress={() => setSelectedPhotoUrl(photo.url || null)}
                  >
                    <Image source={{ uri: photo.url }} style={styles.galleryPhoto} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section 4: Resolution Photos */}
          {resolutionPhotos.length > 0 && (
            <View style={styles.card}>
              <Text style={[styles.sectionHeader, { color: '#34C759' }]}>
                ✅ RESOLUTION PHOTOS ({resolutionPhotos.length})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {resolutionPhotos.map((photo, idx) => (
                  <Pressable
                    key={photo.id || idx}
                    onPress={() => setSelectedPhotoUrl(photo.url || null)}
                  >
                    <Image source={{ uri: photo.url }} style={styles.galleryPhoto} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section 5: Timeline View */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>ACTIVITY & AUDIT TRAIL</Text>
            <TimelineView logs={request.timeline_logs || []} />
          </View>

          {/* Section 6: Export PDF CTA Card */}
          <View style={styles.pdfCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfCardTitle}>Export Audit Report</Text>
              <Text style={styles.pdfCardSub}>
                Generate and download an official summary with photos and timeline.
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.pdfActionBtn, pressed && styles.pressed]}
              onPress={handleExportPdf}
              disabled={pdfGenerating}
            >
              {pdfGenerating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.pdfActionBtnText}>Export PDF</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Fullscreen Photo Modal */}
      <Modal visible={!!selectedPhotoUrl} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.closeModalBtn} onPress={() => setSelectedPhotoUrl(null)}>
            <Text style={styles.closeModalText}>✕</Text>
          </Pressable>
          {selectedPhotoUrl && (
            <Image
              source={{ uri: selectedPhotoUrl }}
              style={styles.modalImage}
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
    backgroundColor: '#F2F2F7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBackText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: -2,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  pdfTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
  },
  pdfTopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  container: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12.5,
    color: '#8E8E93',
    fontWeight: '500',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E5EA',
    marginVertical: 14,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14.5,
    color: '#3A3A3C',
    lineHeight: 20,
  },
  assigneeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  assigneeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  assigneeEmail: {
    fontSize: 12.5,
    color: '#8E8E93',
    marginTop: 1,
  },
  unassignedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF9F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#FFE8D1',
  },
  unassignedIcon: {
    fontSize: 18,
  },
  unassignedText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
    flex: 1,
  },
  photoScroll: {
    marginTop: 6,
  },
  galleryPhoto: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#E5E5EA',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  pdfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
  },
  pdfCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  pdfCardSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    paddingRight: 8,
  },
  pdfActionBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pdfActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  closeModalBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeModalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13.5,
    color: '#8E8E93',
    fontWeight: '500',
  },
  notFoundText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
