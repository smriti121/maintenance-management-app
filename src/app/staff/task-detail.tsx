import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { TimelineView } from '@/components/timeline-view';
import { supabase } from '@/lib/supabase';
import { AiService, AiTriageResult } from '@/services/ai-service';
import { MaintenanceService } from '@/services/maintenance-service';
import { PdfService } from '@/services/pdf-service';
import {
  MaintenanceRequest,
  PhotoType,
  RequestStatus,
  WarrantyStatus,
} from '@/types/maintenance';
import { confirmAction, showAlert } from '@/utils/alert';

export default function StaffTaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<MaintenanceRequest | null>(null);
  const [aiTriage, setAiTriage] = useState<AiTriageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Status Change Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus>('in_progress');
  const [statusNote, setStatusNote] = useState('');

  // Time Log Modal State
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeDescription, setTimeDescription] = useState('');

  // Repair / Replacement Details State
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus>('under_warranty');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [replacementDetails, setReplacementDetails] = useState('');
  const [completionSummary, setCompletionSummary] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Progress Note State
  const [noteText, setNoteText] = useState('');

  // Flag to ensure form inputs are populated once and only once
  const isFormLoadedRef = React.useRef(false);
  const currentTaskIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (currentTaskIdRef.current !== id) {
      currentTaskIdRef.current = id;
      isFormLoadedRef.current = false;
      loadTask(true);
    } else {
      loadTask(false);
    }

    if (!id) return;

    // Realtime websocket listener for live database updates
    const channel = supabase
      .channel(`staff_task_detail_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_requests', filter: `id=eq.${id}` },
        () => {
          loadTask(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_request_photos', filter: `request_id=eq.${id}` },
        () => {
          loadTask(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_timeline_logs', filter: `request_id=eq.${id}` },
        () => {
          loadTask(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_time_logs', filter: `request_id=eq.${id}` },
        () => {
          loadTask(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadTask(isInitialLoad = false) {
    if (!id) return;
    try {
      const data = await MaintenanceService.getRequestById(id);
      setTask(data);
      setSelectedStatus(data.status || 'pending');

      // Populate form fields ONLY on the very first load of this task
      if (!isFormLoadedRef.current || isInitialLoad) {
        setEstimatedCost(data.estimated_cost != null ? String(data.estimated_cost) : '');
        setActualCost(data.actual_cost != null ? String(data.actual_cost) : '');
        setWarrantyStatus(data.warranty_status || 'under_warranty');
        setPurchaseDate(data.purchase_date || '');
        setReplacementDetails(data.replacement_details || '');
        setCompletionSummary(data.completion_summary || '');
        isFormLoadedRef.current = true;
      }

      // Generate AI Smart Task Summary & Triage for Technician
      if (data.title || data.description) {
        AiService.analyzeIssue(data.title || '', data.description || '')
          .then((res) => setAiTriage(res))
          .catch((err) => console.warn('AI Triage error:', err));
      }
    } catch (err: any) {
      console.error('Error loading task:', err);
      showAlert('Error', err?.message || 'Could not load task details.');
    } finally {
      setLoading(false);
    }
  }

  // Quick Status Switcher (Direct 1-tap update on screen)
  async function handleQuickStatusChange(newStatus: RequestStatus) {
    if (!task || task.status === newStatus || submitting) return;
    setSelectedStatus(newStatus);
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Session expired. Please sign in again.');

      await MaintenanceService.updateRequestStatus(
        task.id,
        newStatus,
        user.id,
        `Status updated to ${newStatus.replace(/_/g, ' ').toUpperCase()} by technician.`
      );

      setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      showAlert('Status Updated', `Task status changed to ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err: any) {
      console.error('Quick status update error:', err);
      showAlert('Status Notice', err?.message || 'Could not update status.');
    } finally {
      setSubmitting(false);
    }
  }

  // 1. Export PDF
  async function handleExportPdf() {
    if (!task) return;
    setPdfGenerating(true);
    try {
      await PdfService.exportPdfReport(task);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showAlert('Export Failed', err?.message || 'Could not export PDF report.');
    } finally {
      setPdfGenerating(false);
    }
  }

  // 2. Status Update
  async function handleStatusChange() {
    if (!task) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Session expired');

      await MaintenanceService.updateRequestStatus(
        task.id,
        selectedStatus,
        user.id,
        statusNote.trim() || undefined
      );

      setStatusModalVisible(false);
      setStatusNote('');
      await loadTask();
      showAlert('Status Updated', `Task status changed to ${selectedStatus.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      showAlert('Notice', err?.message || 'Could not update status.');
    } finally {
      setSubmitting(false);
    }
  }

  // 3. Mark Completed Quick Action
  async function handleMarkCompleted() {
    if (!task) return;
    confirmAction({
      title: 'Resolve Task',
      message: 'Are you sure you want to mark this maintenance task as Completed?',
      confirmText: 'Resolve',
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error('Session expired');

          await MaintenanceService.updateRequestStatus(
            task.id,
            'completed',
            user.id,
            'Task marked as completed by technician.'
          );
          await loadTask();
          showAlert('Task Resolved! 🎉', 'Maintenance work marked as completed.');
        } catch (err: any) {
          showAlert('Notice', err?.message || 'Could not complete task.');
        } finally {
          setSubmitting(false);
        }
      },
    });
  }

  // 4. Post Progress Note
  async function handleAddNote() {
    if (!task || !noteText.trim()) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      await MaintenanceService.addStaffNote(task.id, user.id, noteText.trim());
      setNoteText('');
      await loadTask();
      showAlert('Note Posted', 'Progress note added to audit trail.');
    } catch (err: any) {
      showAlert('Notice', err?.message || 'Could not post note.');
    } finally {
      setSubmitting(false);
    }
  }

  // 5. Upload Before/After Photo
  async function handleUploadPhoto(photoType: PhotoType) {
    if (!task) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Access to photo library is required to upload work photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSubmitting(true);
        const asset = result.assets[0];
        let uri = asset.uri;
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          uri = `data:${mime};base64,${asset.base64}`;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error('Session expired');

        await MaintenanceService.uploadPhoto(
          task.id,
          user.id,
          {
            uri,
            name: asset.fileName || `${photoType}-photo-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
          },
          photoType,
          (task.photos || []).length
        );

        await loadTask();
        showAlert('Photo Uploaded', `${photoType.toUpperCase()} photo attached to task.`);
      }
    } catch (err: any) {
      console.error('Photo upload notice:', err);
      showAlert('Photo Notice', err?.message || 'Could not upload photo.');
    } finally {
      setSubmitting(false);
    }
  }

  // 6. Record Time Log
  async function handleRecordTime() {
    if (!task) return;
    const mins = parseInt(timeMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      showAlert('Invalid Time', 'Please enter a valid number of minutes.');
      return;
    }
    if (!timeDescription.trim()) {
      showAlert('Description Required', 'Please describe the maintenance work performed.');
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      await MaintenanceService.recordTimeLog(task.id, user.id, mins, timeDescription.trim());
      setTimeModalVisible(false);
      setTimeMinutes('');
      setTimeDescription('');
      await loadTask();
      showAlert('Time Recorded', `Logged ${mins} minutes for this task.`);
    } catch (err: any) {
      showAlert('Notice', err?.message || 'Could not log time.');
    } finally {
      setSubmitting(false);
    }
  }

  // 7. Save Repair & Warranty Details
  async function handleSaveRepairDetails() {
    if (!task) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      const estNum = estimatedCost.trim() ? parseFloat(estimatedCost.trim()) : null;
      const actNum = actualCost.trim() ? parseFloat(actualCost.trim()) : null;

      await MaintenanceService.updateRepairDetails(task.id, user.id, {
        estimated_cost: estNum !== null && !isNaN(estNum) ? estNum : null,
        actual_cost: actNum !== null && !isNaN(actNum) ? actNum : null,
        warranty_status: warrantyStatus,
        purchase_date: purchaseDate.trim() || null,
        replacement_details: replacementDetails.trim() || null,
        completion_summary: completionSummary.trim() || null,
      });

      setTask((prev) =>
        prev
          ? {
              ...prev,
              estimated_cost: estNum !== null && !isNaN(estNum) ? estNum : null,
              actual_cost: actNum !== null && !isNaN(actNum) ? actNum : null,
              warranty_status: warrantyStatus,
              purchase_date: purchaseDate.trim() || null,
              replacement_details: replacementDetails.trim() || null,
              completion_summary: completionSummary.trim() || null,
            }
          : null
      );

      showAlert('Details Saved ✅', 'Financial, warranty, and replacement details have been saved successfully.');
    } catch (err: any) {
      console.error('Save repair details notice:', err);
      showAlert('Save Notice', err?.message || 'Could not save repair details.');
    } finally {
      setSubmitting(false);
    }
  }

  // 8. AI Generate Completion Summary
  async function handleAiGenerateSummary() {
    if (!task) return;
    setAiGenerating(true);
    setAiNotice(null);
    try {
      const loggedMinutes = (task.time_logs || []).reduce(
        (acc, log) => acc + (log.duration_minutes || 0),
        0
      );

      const parsedCost = actualCost.trim() ? parseFloat(actualCost.trim()) : undefined;

      const summary = await AiService.generateCompletionSummary({
        title: task.title || 'Maintenance Work Order',
        description: task.description || 'Facility maintenance and repair task',
        replacementDetails: replacementDetails.trim() || undefined,
        timeSpentMinutes: loggedMinutes > 0 ? loggedMinutes : 30,
        actualCost: parsedCost !== undefined && !isNaN(parsedCost) ? parsedCost : undefined,
        warrantyStatus: warrantyStatus || 'under_warranty',
      });

      setCompletionSummary(summary);
      setAiNotice('✨ AI summary generated below! Review and tap Save Repair Details.');
    } catch (err: any) {
      console.error('AI summary error:', err);
      setAiNotice('Could not generate AI summary. Please enter manually.');
    } finally {
      setAiGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading technician workspace...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundText}>Task not found.</Text>
        <Pressable style={styles.navBackBtn} onPress={() => router.back()}>
          <Text style={styles.navBackText}>‹</Text>
        </Pressable>
      </View>
    );
  }

  const issuePhotos = (task.photos || []).filter(
    (p) => !p.photo_type || p.photo_type === 'issue'
  );
  const beforePhotos = (task.photos || []).filter((p) => p.photo_type === 'before');
  const afterPhotos = (task.photos || []).filter(
    (p) => p.photo_type === 'after' || p.photo_type === 'completion'
  );

  const totalTimeMinutes = (task.time_logs || []).reduce(
    (acc, log) => acc + (log.duration_minutes || 0),
    0
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* iOS Top Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.navBackBtn}>
            <Text style={styles.navBackText}>‹</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>Technician Workspace</Text>
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Section 1: Task Header & Actions */}
            <View style={styles.card}>
              <View style={styles.badgeRow}>
                <StatusBadge status={task.status || 'pending'} size="medium" />
                <PriorityBadge priority={task.priority || 'medium'} size="medium" />
              </View>

              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.descriptionText}>{task.description}</Text>

              {/* Resident Box */}
              <View style={styles.requesterCard}>
                <Text style={styles.requesterLabel}>RESIDENT / REQUESTER</Text>
                <Text style={styles.requesterName}>
                  {task.requester?.full_name || task.requester?.email || 'Resident'}
                </Text>
                <Text style={styles.requesterEmail}>{task.requester?.email || 'N/A'}</Text>
              </View>

              {/* Interactive Status Selector Chips */}
              <Text style={styles.fieldLabel}>WORK ORDER STATUS</Text>
              <View style={styles.statusChipsGrid}>
                {(
                  [
                    ['assigned', '⏳ Assigned', '#64748B', '#F1F5F9'],
                    ['in_progress', '▶️ In Progress', '#007AFF', '#EBF4FF'],
                    ['on_hold', '⏸️ On Hold', '#FF9500', '#FFF8EB'],
                    ['completed', '✅ Completed', '#34C759', '#EBF9F1'],
                  ] as [RequestStatus, string, string, string][]
                ).map(([st, label, activeColor, activeBg]) => {
                  const isSelected = task.status === st;
                  return (
                    <Pressable
                      key={st}
                      style={[
                        styles.statusQuickChip,
                        isSelected && {
                          backgroundColor: activeBg,
                          borderColor: activeColor,
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() => handleQuickStatusChange(st)}
                      disabled={submitting}
                    >
                      <Text
                        style={[
                          styles.statusQuickChipText,
                          isSelected && { color: activeColor, fontWeight: '800' },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Status Note & Quick Actions */}
              <View style={styles.statusActionRow}>
                <Pressable
                  style={styles.statusChangeBtn}
                  onPress={() => setStatusModalVisible(true)}
                  disabled={submitting}
                >
                  <Text style={styles.statusChangeBtnText}>📝 Add Status Note</Text>
                </Pressable>
              </View>
            </View>

            {/* Section 2: AI Smart Task Summary & Triage Card */}
            {aiTriage && (
              <View style={styles.aiTriageCard}>
                <View style={styles.aiTriageHeader}>
                  <View style={styles.aiTriageBadge}>
                    <Text style={styles.aiTriageBadgeText}>🤖 AI Task Summary & Triage</Text>
                  </View>
                  <Text style={styles.aiCategoryTag}>{aiTriage.category}</Text>
                </View>

                <Text style={styles.aiExplanationText}>{aiTriage.explanation}</Text>

                <View style={styles.aiMetricsRow}>
                  <View style={styles.aiMetricBox}>
                    <Text style={styles.aiMetricLabel}>Estimated Labor</Text>
                    <Text style={styles.aiMetricValue}>{aiTriage.estimatedDuration}</Text>
                  </View>
                  <View style={styles.aiMetricBox}>
                    <Text style={styles.aiMetricLabel}>Cost Benchmark</Text>
                    <Text style={styles.aiMetricValue}>{aiTriage.estimatedCostRange}</Text>
                  </View>
                  <View style={styles.aiMetricBox}>
                    <Text style={styles.aiMetricLabel}>Priority Level</Text>
                    <Text
                      style={[
                        styles.aiMetricValue,
                        {
                          color:
                            aiTriage.recommendedPriority === 'urgent'
                              ? '#FF3B30'
                              : aiTriage.recommendedPriority === 'high'
                              ? '#FF9500'
                              : '#34C759',
                        },
                      ]}
                    >
                      {aiTriage.recommendedPriority.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {aiTriage.safetyAdvice && aiTriage.safetyAdvice.length > 0 && (
                  <View style={styles.aiSafetyBox}>
                    <Text style={styles.aiSafetyTitle}>⚠️ Safety & Diagnostic Protocol:</Text>
                    {aiTriage.safetyAdvice.map((advice, idx) => (
                      <Text key={idx} style={styles.aiSafetyItem}>
                        • {advice}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Section 2: Photos Gallery (Issue, Before, After) */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>TASK EVIDENCE & PHOTOS</Text>

              {/* Issue Photos */}
              <Text style={styles.photoSubHeader}>
                Reported Issue Photos ({issuePhotos.length})
              </Text>
              {issuePhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {issuePhotos.map((p, idx) => (
                    <Pressable key={p.id || idx} onPress={() => setFullscreenPhoto(p.url || null)}>
                      <Image source={{ uri: p.url }} style={styles.photoThumb} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyNote}>No initial photos attached.</Text>
              )}

              {/* Before Photos */}
              <View style={styles.photoSectionHeader}>
                <Text style={styles.photoSubHeader}>Before-Repair Photos ({beforePhotos.length})</Text>
                <Pressable
                  style={styles.addPhotoSmallBtn}
                  onPress={() => handleUploadPhoto('before')}
                  disabled={submitting}
                >
                  <Text style={styles.addPhotoSmallText}>＋ Add Before</Text>
                </Pressable>
              </View>
              {beforePhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {beforePhotos.map((p, idx) => (
                    <Pressable key={p.id || idx} onPress={() => setFullscreenPhoto(p.url || null)}>
                      <Image source={{ uri: p.url }} style={styles.photoThumb} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyNote}>No before photos uploaded yet.</Text>
              )}

              {/* After Photos */}
              <View style={styles.photoSectionHeader}>
                <Text style={[styles.photoSubHeader, { color: '#34C759' }]}>
                  After / Completion Photos ({afterPhotos.length})
                </Text>
                <Pressable
                  style={[styles.addPhotoSmallBtn, { backgroundColor: '#EBF9F1' }]}
                  onPress={() => handleUploadPhoto('after')}
                  disabled={submitting}
                >
                  <Text style={[styles.addPhotoSmallText, { color: '#34C759' }]}>＋ Add After</Text>
                </Pressable>
              </View>
              {afterPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {afterPhotos.map((p, idx) => (
                    <Pressable key={p.id || idx} onPress={() => setFullscreenPhoto(p.url || null)}>
                      <Image source={{ uri: p.url }} style={styles.photoThumb} contentFit="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptyNote}>No completion photos uploaded yet.</Text>
              )}
            </View>

            {/* Section 3: Time Logs */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionHeader}>LABOR & TIME LOGS</Text>
                  <Text style={styles.timeSummaryText}>
                    Total Logged: {Math.floor(totalTimeMinutes / 60)}h {totalTimeMinutes % 60}m
                  </Text>
                </View>
                <Pressable
                  style={styles.logTimeBtn}
                  onPress={() => setTimeModalVisible(true)}
                  disabled={submitting}
                >
                  <Text style={styles.logTimeBtnText}>⏱️ Log Time</Text>
                </Pressable>
              </View>

              {(task.time_logs || []).length > 0 ? (
                <View style={styles.timeLogList}>
                  {task.time_logs?.map((tl) => (
                    <View key={tl.id} style={styles.timeLogItem}>
                      <View style={styles.timeLogHeader}>
                        <Text style={styles.timeLogDuration}>{tl.duration_minutes} mins</Text>
                        <Text style={styles.timeLogDate}>
                          {tl.created_at ? new Date(tl.created_at).toLocaleDateString() : ''}
                        </Text>
                      </View>
                      <Text style={styles.timeLogDesc}>{tl.description}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>No work time logged yet.</Text>
              )}
            </View>

            {/* Section 4: Cost, Warranty & Parts */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>COST, WARRANTY & PARTS DETAILS</Text>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ESTIMATED COST ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={estimatedCost}
                    onChangeText={setEstimatedCost}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ACTUAL COST ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={actualCost}
                    onChangeText={setActualCost}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>WARRANTY STATUS</Text>
              <View style={styles.warrantyRow}>
                {(
                  [
                    ['under_warranty', 'Under Warranty'],
                    ['out_of_warranty', 'Out of Warranty'],
                    ['not_applicable', 'N/A'],
                  ] as [WarrantyStatus, string][]
                ).map(([ws, label]) => (
                  <Pressable
                    key={ws}
                    style={[
                      styles.warrantyChip,
                      warrantyStatus === ws && styles.warrantyChipSelected,
                    ]}
                    onPress={() => setWarrantyStatus(ws)}
                  >
                    <Text
                      style={[
                        styles.warrantyChipText,
                        warrantyStatus === ws && styles.warrantyChipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>PURCHASE / ASSET INFO</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Purchased March 2024 (Invoice #8491)"
                placeholderTextColor="#8E8E93"
                value={purchaseDate}
                onChangeText={setPurchaseDate}
              />

              <Text style={styles.fieldLabel}>REPLACEMENT PARTS / WORK PERFORMED</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Replaced capacitor 45uF, rewired thermal fuse..."
                placeholderTextColor="#8E8E93"
                value={replacementDetails}
                onChangeText={setReplacementDetails}
                multiline
              />

              {/* Completion Summary with AI */}
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.fieldLabel}>COMPLETION SUMMARY</Text>
                <Pressable
                  style={({ pressed }) => [styles.aiSmallBtn, pressed && styles.pressed]}
                  onPress={handleAiGenerateSummary}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <ActivityIndicator size="small" color="#AF52DE" />
                  ) : (
                    <Text style={styles.aiSmallBtnText}>✨ AI Generate Summary</Text>
                  )}
                </Pressable>
              </View>

              {aiNotice && (
                <View style={styles.aiNoticeCard}>
                  <Text style={styles.aiNoticeText}>{aiNotice}</Text>
                </View>
              )}

              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Technical summary for the final audit report..."
                placeholderTextColor="#8E8E93"
                value={completionSummary}
                onChangeText={(val) => {
                  setCompletionSummary(val);
                  setAiNotice(null);
                }}
                multiline
              />

              <Pressable
                style={({ pressed }) => [styles.saveDetailsBtn, pressed && styles.pressed]}
                onPress={handleSaveRepairDetails}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveDetailsBtnText}>💾 Save Repair Details</Text>
                )}
              </Pressable>
            </View>

            {/* Section 5: Add Note */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>APPEND AUDIT TRAIL NOTE</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Write a progress note for the audit history..."
                placeholderTextColor="#8E8E93"
                value={noteText}
                onChangeText={setNoteText}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.addNoteBtn,
                  pressed && styles.pressed,
                  !noteText.trim() && styles.btnDisabled,
                ]}
                onPress={handleAddNote}
                disabled={submitting || !noteText.trim()}
              >
                <Text style={styles.addNoteBtnText}>Post Note</Text>
              </Pressable>
            </View>

            {/* Section 6: Audit Trail */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>TIMELINE & AUDIT TRAIL</Text>
              <TimelineView logs={task.timeline_logs || []} />
            </View>
          </View>
        </ScrollView>

        {/* Status Modal */}
        <Modal visible={statusModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalGrabHandle} />
              <Text style={styles.modalTitle}>Update Task Status</Text>

              <View style={styles.statusOptions}>
                {(['assigned', 'in_progress', 'on_hold', 'completed'] as RequestStatus[]).map(
                  (st) => (
                    <Pressable
                      key={st}
                      style={[
                        styles.statusOption,
                        selectedStatus === st && styles.statusOptionSelected,
                      ]}
                      onPress={() => setSelectedStatus(st)}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          selectedStatus === st && styles.statusOptionTextSelected,
                        ]}
                      >
                        {st.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>

              <Text style={styles.fieldLabel}>STATUS NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.textInput, { height: 70 }]}
                placeholder="e.g. Waiting for spare part delivery..."
                placeholderTextColor="#8E8E93"
                value={statusNote}
                onChangeText={setStatusNote}
                multiline
              />

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setStatusModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSubmitBtn}
                  onPress={handleStatusChange}
                  disabled={submitting}
                >
                  <Text style={styles.modalSubmitText}>Save Status</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Time Modal */}
        <Modal visible={timeModalVisible} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalGrabHandle} />
              <Text style={styles.modalTitle}>Log Work Duration</Text>

              <Text style={styles.fieldLabel}>DURATION (MINUTES) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 45"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                value={timeMinutes}
                onChangeText={setTimeMinutes}
              />

              <Text style={styles.fieldLabel}>WORK DESCRIPTION *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Disassembled pipe, cleared debris, tested valve"
                placeholderTextColor="#8E8E93"
                value={timeDescription}
                onChangeText={setTimeDescription}
                multiline
              />

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => setTimeModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSubmitBtn}
                  onPress={handleRecordTime}
                  disabled={submitting}
                >
                  <Text style={styles.modalSubmitText}>Record Time</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Fullscreen Photo Modal */}
        <Modal visible={!!fullscreenPhoto} transparent animationType="fade">
          <View style={styles.photoModalBackdrop}>
            <Pressable style={styles.closeModalBtn} onPress={() => setFullscreenPhoto(null)}>
              <Text style={styles.closeModalText}>✕</Text>
            </Pressable>
            {fullscreenPhoto && (
              <Image source={{ uri: fullscreenPhoto }} style={styles.modalImage} contentFit="contain" />
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  descriptionText: {
    fontSize: 14.5,
    color: '#3A3A3C',
    lineHeight: 20,
  },
  requesterCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  requesterLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  requesterName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#000000',
  },
  requesterEmail: {
    fontSize: 12,
    color: '#8E8E93',
  },
  statusChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  statusQuickChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  statusQuickChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#636366',
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  statusChangeBtn: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E5EA',
  },
  statusChangeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#636366',
  },
  completeActionBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  aiTriageCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    shadowColor: '#AF52DE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  aiTriageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  aiTriageBadge: {
    backgroundColor: '#AF52DE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiTriageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  aiCategoryTag: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7E22CE',
  },
  aiExplanationText: {
    fontSize: 13.5,
    color: '#4C1D95',
    lineHeight: 19,
    marginBottom: 12,
  },
  aiMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  aiMetricBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E9D5FF',
  },
  aiMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  aiMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  aiSafetyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#E9D5FF',
  },
  aiSafetyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#C2410C',
    marginBottom: 4,
  },
  aiSafetyItem: {
    fontSize: 12,
    color: '#431407',
    lineHeight: 17,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  photoSubHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    marginTop: 8,
    marginBottom: 6,
  },
  photoSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  addPhotoSmallBtn: {
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addPhotoSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
  },
  photoScroll: {
    marginVertical: 4,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#E5E5EA',
    borderWidth: 0.5,
    borderColor: '#D1D1D6',
  },
  emptyNote: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginVertical: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeSummaryText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '700',
    marginTop: 2,
  },
  logTimeBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  logTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  timeLogList: {
    gap: 8,
  },
  timeLogItem: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 10,
  },
  timeLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLogDuration: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  timeLogDate: {
    fontSize: 11.5,
    color: '#8E8E93',
  },
  timeLogDesc: {
    fontSize: 12.5,
    color: '#3A3A3C',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  textArea: {
    height: 80,
    paddingTop: 10,
  },
  warrantyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  warrantyChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    alignItems: 'center',
  },
  warrantyChipSelected: {
    backgroundColor: '#007AFF',
  },
  warrantyChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
  },
  warrantyChipTextSelected: {
    color: '#FFFFFF',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  aiSmallBtn: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E9D5FF',
  },
  aiSmallBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#AF52DE',
  },
  aiNoticeCard: {
    backgroundColor: '#F5EEFB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: '#E9D5FF',
  },
  aiNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E22CE',
    lineHeight: 16,
  },
  saveDetailsBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  addNoteBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addNoteBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalGrabHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 14,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  statusOptionSelected: {
    backgroundColor: '#007AFF',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
  },
  statusOptionTextSelected: {
    color: '#FFFFFF',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoModalBackdrop: {
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
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
