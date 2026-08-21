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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ExecutiveHeader } from '@/components/executive-header';
import { PriorityBadge, StatusBadge } from '@/components/status-badge';
import { TimelineView } from '@/components/timeline-view';
import { ExecutiveTheme, formatINR } from '@/constants/theme';
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
        () => loadTask(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_request_photos', filter: `request_id=eq.${id}` },
        () => loadTask(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_timeline_logs', filter: `request_id=eq.${id}` },
        () => loadTask(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_time_logs', filter: `request_id=eq.${id}` },
        () => loadTask(false)
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

  // 3. Post Progress Note
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
      showAlert('Note Posted', 'Progress update logged into immutable audit trail.');
    } catch (err: any) {
      showAlert('Notice', err?.message || 'Could not add note.');
    } finally {
      setSubmitting(false);
    }
  }

  // 4. Photo Upload (Before / After)
  async function handleUploadPhoto(photoType: PhotoType) {
    if (!task) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'FixFlow requires photo access to attach inspection photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        let uri = asset.uri;
        const mime = asset.mimeType || 'image/jpeg';
        if (asset.base64) {
          uri = `data:${mime};base64,${asset.base64}`;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error('Session expired');

        setSubmitting(true);
        await MaintenanceService.uploadPhoto(
          task.id,
          user.id,
          {
            uri,
            name: asset.fileName || `${photoType}-photo-${Date.now()}.jpg`,
            mimeType: mime,
          },
          photoType,
          0
        );

        await loadTask();
        showAlert('Photo Uploaded', `${photoType.toUpperCase()} photo attached to task.`);
      }
    } catch (err: any) {
      console.error('Photo upload error:', err);
      showAlert('Photo Notice', err?.message || 'Could not upload photo.');
    } finally {
      setSubmitting(false);
    }
  }

  // 5. Log Time (Labor Duration)
  async function handleLogTime() {
    if (!task) return;
    const mins = parseInt(timeMinutes.trim(), 10);
    if (isNaN(mins) || mins <= 0) {
      showAlert('Invalid Time', 'Please enter a valid positive duration in minutes.');
      return;
    }

    if (!timeDescription.trim()) {
      showAlert('Missing Description', 'Please enter a short description of the work performed.');
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
      console.error('Time log error:', err);
      showAlert('Time Log Notice', err?.message || 'Could not log time.');
    } finally {
      setSubmitting(false);
    }
  }

  // 6. Save Repair & Replacement Details (in ₹ INR)
  async function handleSaveRepairDetails() {
    if (!task) return;
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');

      const parsedEst = estimatedCost.trim() ? parseFloat(estimatedCost.trim()) : undefined;
      const parsedAct = actualCost.trim() ? parseFloat(actualCost.trim()) : undefined;

      await MaintenanceService.updateRepairDetails(task.id, user.id, {
        estimated_cost: parsedEst !== undefined && !isNaN(parsedEst) ? parsedEst : null,
        actual_cost: parsedAct !== undefined && !isNaN(parsedAct) ? parsedAct : null,
        warranty_status: warrantyStatus,
        purchase_date: purchaseDate.trim() || undefined,
        replacement_details: replacementDetails.trim() || undefined,
        completion_summary: completionSummary.trim() || undefined,
      });

      setTask((prev) =>
        prev
          ? {
              ...prev,
              estimated_cost: parsedEst !== undefined && !isNaN(parsedEst) ? parsedEst : null,
              actual_cost: parsedAct !== undefined && !isNaN(parsedAct) ? parsedAct : null,
              warranty_status: warrantyStatus,
              purchase_date: purchaseDate.trim() || null,
              replacement_details: replacementDetails.trim() || null,
              completion_summary: completionSummary.trim() || null,
            }
          : null
      );

      showAlert('Details Saved ✅', 'Financial quotes, warranty, and replacement details saved in ₹ INR.');
    } catch (err: any) {
      console.error('Save repair details notice:', err);
      showAlert('Save Notice', err?.message || 'Could not save repair details.');
    } finally {
      setSubmitting(false);
    }
  }

  // 7. AI Generate Completion Summary
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
      <SafeAreaView style={styles.screen}>
        <ExecutiveHeader title="Technician Workspace" showBack={true} fallbackRoute="/staff/dashboard" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandDark} />
          <Text style={styles.loadingText}>Loading technician workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.screen}>
        <ExecutiveHeader title="Technician Workspace" showBack={true} fallbackRoute="/staff/dashboard" />
        <View style={styles.centerContainer}>
          <Text style={styles.notFoundText}>Task not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const issuePhotos = (task.photos || []).filter(
    (p) => !p.photo_type || p.photo_type === 'issue' || p.photo_type === 'before'
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
      <ExecutiveHeader
        title="Technician Workspace"
        subtitle={`Order #${(task.id || '').slice(0, 8).toUpperCase()}`}
        showBack={true}
        fallbackRoute="/staff/dashboard"
        rightElement={
          <Pressable
            style={({ pressed }) => [styles.pdfTopBtn, pressed && styles.pressed]}
            onPress={handleExportPdf}
            disabled={pdfGenerating}
          >
            {pdfGenerating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.pdfTopBtnText}>📄 PDF Report</Text>
            )}
          </Pressable>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Section 1: Task Header & Status Selector */}
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

              {/* 1-Tap Quick Status Switcher Chips */}
              <Text style={styles.fieldLabel}>UPDATE WORK ORDER STATUS</Text>
              <View style={styles.statusChipsGrid}>
                {(
                  [
                    ['assigned', '⏳ Assigned', '#64748B', '#F1F5F9'],
                    ['in_progress', '▶️ In Progress', '#B45309', '#FFFBEB'],
                    ['on_hold', '⏸️ On Hold', '#C2410C', '#FFF7ED'],
                    ['completed', '✅ Resolved', '#15803D', '#F0FDF4'],
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

              <Pressable
                style={styles.addNoteBtnAlt}
                onPress={() => setStatusModalVisible(true)}
                disabled={submitting}
              >
                <Text style={styles.addNoteBtnAltText}>📝 Add Custom Status Note</Text>
              </Pressable>
            </View>

            {/* Section 2: AI Smart Task Summary & Triage Card */}
            {aiTriage && (
              <View style={styles.aiTriageCard}>
                <View style={styles.aiTriageHeader}>
                  <View style={styles.aiTriageBadge}>
                    <Text style={styles.aiTriageBadgeText}>🤖 AI Task Diagnostic</Text>
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
                    <Text style={styles.aiMetricLabel}>Cost Benchmark (₹)</Text>
                    <Text style={styles.aiMetricValue}>{aiTriage.estimatedCostRange}</Text>
                  </View>
                  <View style={styles.aiMetricBox}>
                    <Text style={styles.aiMetricLabel}>Priority Level</Text>
                    <Text style={styles.aiMetricValue}>
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

            {/* Section 3: Time Logging & Labor */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeader}>LABOR DURATION & WORK LOGS</Text>
                <Pressable
                  style={({ pressed }) => [styles.actionSmallBtn, pressed && styles.pressed]}
                  onPress={() => setTimeModalVisible(true)}
                  disabled={submitting}
                >
                  <Text style={styles.actionSmallBtnText}>＋ Log Time</Text>
                </Pressable>
              </View>

              <View style={styles.timeSummaryCard}>
                <Text style={styles.timeSummaryNum}>{totalTimeMinutes} mins</Text>
                <Text style={styles.timeSummaryLabel}>
                  Total Labor Recorded ({(totalTimeMinutes / 60).toFixed(1)} hrs)
                </Text>
              </View>

              {task.time_logs && task.time_logs.length > 0 ? (
                <View style={styles.timeLogsList}>
                  {task.time_logs.map((log) => (
                    <View key={log.id} style={styles.timeLogItem}>
                      <View style={styles.timeLogHeader}>
                        <Text style={styles.timeLogMins}>{log.duration_minutes} mins</Text>
                        <Text style={styles.timeLogDate}>
                          {log.created_at
                            ? new Date(log.created_at).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Today'}
                        </Text>
                      </View>
                      <Text style={styles.timeLogDesc}>{log.description}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>No labor duration logged yet.</Text>
              )}
            </View>

            {/* Section 4: Parts, Costs (in ₹ INR) & Completion Summary */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>FINANCIALS, PARTS & AUDIT SUMMARY (₹ INR)</Text>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ESTIMATED COST (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    keyboardType="numeric"
                    value={estimatedCost}
                    onChangeText={setEstimatedCost}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ACTUAL COST (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
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
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
              />

              <Text style={styles.fieldLabel}>REPLACEMENT PARTS / WORK PERFORMED</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Replaced capacitor 45uF, rewired thermal fuse..."
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
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
                    <ActivityIndicator size="small" color={ExecutiveTheme.colors.brandDark} />
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
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
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
                  <Text style={styles.saveDetailsBtnText}>💾 Save Repair Details (₹)</Text>
                )}
              </Pressable>
            </View>

            {/* Section 5: Photos Evidence */}
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
                <Text style={[styles.photoSubHeader, { color: '#15803D' }]}>
                  After / Completion Photos ({afterPhotos.length})
                </Text>
                <Pressable
                  style={[styles.addPhotoSmallBtn, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                  onPress={() => handleUploadPhoto('after')}
                  disabled={submitting}
                >
                  <Text style={[styles.addPhotoSmallText, { color: '#15803D' }]}>＋ Add After</Text>
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
                <Text style={styles.emptyNote}>No completion photos attached.</Text>
              )}
            </View>

            {/* Section 6: Append Note & Audit Trail */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>APPEND AUDIT TRAIL NOTE</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Write a progress note for the audit history..."
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
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
                <Text style={styles.addNoteBtnText}>Post Audit Note</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionHeader}>TIMELINE & AUDIT TRAIL</Text>
              <TimelineView logs={task.timeline_logs || []} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
              style={[styles.textInput, styles.textArea]}
              placeholder="e.g. Waiting for replacement capacitor..."
              placeholderTextColor={ExecutiveTheme.colors.textMuted}
              value={statusNote}
              onChangeText={setStatusNote}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setStatusModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleStatusChange}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Status</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time Log Modal */}
      <Modal visible={timeModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalGrabHandle} />
            <Text style={styles.modalTitle}>Log Work Duration</Text>

            <Text style={styles.fieldLabel}>DURATION (MINUTES) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="45"
              placeholderTextColor={ExecutiveTheme.colors.textMuted}
              keyboardType="numeric"
              value={timeMinutes}
              onChangeText={setTimeMinutes}
            />

            <Text style={styles.fieldLabel}>WORK DESCRIPTION *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="e.g. Disassembled motor, replaced capacitor, verified voltage."
              placeholderTextColor={ExecutiveTheme.colors.textMuted}
              value={timeDescription}
              onChangeText={setTimeDescription}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setTimeModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleLogTime}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Record Labor</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Viewer */}
      <Modal visible={!!fullscreenPhoto} transparent animationType="fade">
        <View style={styles.fullscreenModal}>
          <Pressable style={styles.closeModalBtn} onPress={() => setFullscreenPhoto(null)}>
            <Text style={styles.closeModalText}>✕ Close</Text>
          </Pressable>
          {fullscreenPhoto && (
            <Image
              source={{ uri: fullscreenPhoto }}
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
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 20,
  },
  requesterCard: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  requesterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textMuted,
    letterSpacing: 0.4,
  },
  requesterName: {
    fontSize: 14,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginTop: 2,
  },
  requesterEmail: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
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
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  statusQuickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  addNoteBtnAlt: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    marginTop: 4,
  },
  addNoteBtnAltText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  aiTriageCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    ...ExecutiveTheme.shadows.soft,
  },
  aiTriageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiTriageBadge: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiTriageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  aiCategoryTag: {
    fontSize: 12.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandDark,
  },
  aiExplanationText: {
    fontSize: 13,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  aiMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  aiMetricBox: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  aiMetricLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textMuted,
    textTransform: 'uppercase',
  },
  aiMetricValue: {
    fontSize: 12,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginTop: 2,
  },
  aiSafetyBox: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  aiSafetyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
    marginBottom: 2,
  },
  aiSafetyItem: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  actionSmallBtn: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  timeSummaryCard: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  timeSummaryNum: {
    fontSize: 20,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandDark,
  },
  timeSummaryLabel: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  timeLogsList: {
    gap: 8,
  },
  timeLogItem: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  timeLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLogMins: {
    fontSize: 12.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandDark,
  },
  timeLogDate: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textMuted,
  },
  timeLogDesc: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 4,
  },
  emptyNote: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textMuted,
    fontStyle: 'italic',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  warrantyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  warrantyChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  warrantyChipSelected: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    borderColor: ExecutiveTheme.colors.brandDark,
  },
  warrantyChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  warrantyChipTextSelected: {
    color: '#FFFFFF',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  aiSmallBtn: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  aiSmallBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.brandDark,
  },
  aiNoticeCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 0.8,
    borderColor: '#BBF7D0',
  },
  aiNoticeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803D',
  },
  saveDetailsBtn: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  photoSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  photoSubHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
  },
  addPhotoSmallBtn: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  addPhotoSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  photoScroll: {
    marginTop: 4,
  },
  photoThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  addNoteBtn: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addNoteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pdfTopBtn: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pdfTopBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalGrabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: ExecutiveTheme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginBottom: 12,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  statusOptionSelected: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
    borderColor: ExecutiveTheme.colors.brandDark,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  statusOptionTextSelected: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  modalCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: ExecutiveTheme.colors.brandDark,
  },
  modalSaveText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
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
  btnDisabled: {
    backgroundColor: '#94A3B8',
  },
  pressed: {
    opacity: 0.75,
  },
});
