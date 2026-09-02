import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { ExecutiveHeader } from '@/components/executive-header';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { supabase } from '@/lib/supabase';
import { EquipmentQrSheetModal } from '@/components/equipment-qr-sheet-modal';
import { EquipmentTagCard } from '@/components/equipment-tag-card';
import { QrScannerModal } from '@/components/qr-scanner-modal';
import { AiService, AiTriageResult } from '@/services/ai-service';
import { EquipmentService } from '@/services/equipment-service';
import { MaintenanceService, SelectedPhotoInput } from '@/services/maintenance-service';
import { Equipment, Priority } from '@/types/maintenance';
import { showAlert } from '@/utils/alert';

export default function CreateRequestScreen() {
  const params = useLocalSearchParams<{ initialTitle?: string; productId?: string }>();
  const [title, setTitle] = useState(params.initialTitle || '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [photos, setPhotos] = useState<SelectedPhotoInput[]>([]);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [assetSheetVisible, setAssetSheetVisible] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiTriageResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (params.initialTitle) {
      setTitle(params.initialTitle);
    }
  }, [params.initialTitle]);

  useEffect(() => {
    if (params.productId) {
      EquipmentService.getEquipmentByProductId(params.productId)
        .then((eq) => {
          if (eq) {
            handleEquipmentIdentified(eq);
          }
        })
        .catch((err) => console.warn('Param equipment load error:', err));
    }
  }, [params.productId]);

  function handleEquipmentIdentified(eq: Equipment) {
    setEquipment(eq);
    if (!title.trim()) {
      setTitle(`${eq.name} Maintenance - ${eq.location}`);
    }
    // Auto-triage with equipment context if description exists
    if (description.trim()) {
      AiService.analyzeIssue(eq.name, `${description} (Equipment: ${eq.name}, Model: ${eq.model || 'N/A'}, Location: ${eq.location})`)
        .then((res) => {
          setAiResult(res);
          if (res.recommendedPriority) setPriority(res.recommendedPriority);
        })
        .catch(() => {});
    }
  }

  const presetIssues = [
    {
      label: t('createRequest.presets.fanIssue', 'Fan Issue'),
      icon: 'sync-outline' as const,
      title: t('createRequest.presets.fanIssueTitle', 'Ceiling Fan Not Working'),
      desc: t('createRequest.presets.fanIssueDesc', 'Ceiling fan is not rotating / making grinding noise. Requires inspection of regulator and motor.'),
      priority: 'medium' as Priority,
    },
    {
      label: t('createRequest.presets.bulbLight', 'Bulb / Light'),
      icon: 'bulb-outline' as const,
      title: t('createRequest.presets.bulbLightTitle', 'Bulb / Lighting Fixture Issue'),
      desc: t('createRequest.presets.bulbLightDesc', 'Light bulb has fused and needs replacement. Fixture power supply needs checking.'),
      priority: 'low' as Priority,
    },
    {
      label: t('createRequest.presets.acService', 'AC Issue'),
      icon: 'snow-outline' as const,
      title: t('createRequest.presets.acServiceTitle', 'Air Conditioner Cooling Issue'),
      desc: t('createRequest.presets.acServiceDesc', 'AC is not cooling effectively / blowing warm air. Filters and gas pressure need inspection.'),
      priority: 'high' as Priority,
    },
    {
      label: t('createRequest.presets.plumbing', 'Plumbing'),
      icon: 'water-outline' as const,
      title: t('createRequest.presets.plumbingTitle', 'Plumbing & Tap Leakage'),
      desc: t('createRequest.presets.plumbingDesc', 'Continuous water leakage observed from bathroom/kitchen pipeline. Requires valve and joint sealing.'),
      priority: 'high' as Priority,
    },
    {
      label: t('createRequest.presets.electrical', 'Electrical'),
      icon: 'flash-outline' as const,
      title: t('createRequest.presets.electricalTitle', 'Electrical Switch / Power Issue'),
      desc: t('createRequest.presets.electricalDesc', 'Power socket is sparking / unresponsive. Circuit breaker trips when appliance is connected.'),
      priority: 'urgent' as Priority,
    },
  ];

  function handleSelectPreset(preset: (typeof presetIssues)[0]) {
    setTitle(preset.title);
    setDescription(preset.desc);
    setPriority(preset.priority);

    // Auto trigger AI triage
    AiService.analyzeIssue(preset.title, preset.desc)
      .then((res) => setAiResult(res))
      .catch((err) => console.warn('AI Triage error:', err));
  }

  // 1. Smart AI Triage Analysis
  async function handleAiTriage() {
    if (!title.trim() && !description.trim()) {
      showAlert(
        t('createRequest.alerts.enterDetailsFirstTitle', 'Enter Details First'),
        t('createRequest.alerts.enterDetailsFirstMsg', 'Please enter an issue title or description for AI analysis.')
      );
      return;
    }

    setAiAnalyzing(true);
    try {
      const result = await AiService.analyzeIssue(title, description);
      setAiResult(result);
      if (result.recommendedPriority) {
        setPriority(result.recommendedPriority);
      }
    } catch (err: any) {
      console.warn('AI Triage notice:', err);
    } finally {
      setAiAnalyzing(false);
    }
  }

  // 2. Photo Picker
  async function pickPhotos() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          t('createRequest.alerts.permissionRequiredTitle', 'Permission Required'),
          t('createRequest.alerts.permissionRequiredMsg', 'FixFlow requires access to your photo library to attach photos.')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets) {
        const newPhotos: SelectedPhotoInput[] = result.assets.map((asset, index) => {
          let uri = asset.uri;
          if (asset.base64) {
            const mime = asset.mimeType || 'image/jpeg';
            uri = `data:${mime};base64,${asset.base64}`;
          }
          return {
            uri,
            name: asset.fileName || `issue-photo-${Date.now()}-${index}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
          };
        });

        setPhotos((prev) => [...prev, ...newPhotos]);
      }
    } catch (err: any) {
      console.warn('Photo picker error:', err);
    }
  }

  async function takePhoto() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          t('createRequest.alerts.permissionRequiredTitle', 'Permission Required'),
          t('createRequest.alerts.cameraPermissionMsg', 'FixFlow requires camera access to capture evidence photos.')
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let uri = asset.uri;
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          uri = `data:${mime};base64,${asset.base64}`;
        }
        const newPhoto: SelectedPhotoInput = {
          uri,
          name: asset.fileName || `camera-photo-${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        };
        setPhotos((prev) => [...prev, newPhoto]);
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // 3. Submit Request
  async function handleSubmit() {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle || !cleanDescription) {
      showAlert(
        t('createRequest.alerts.missingFieldsTitle', 'Missing Fields'),
        t('createRequest.alerts.missingFieldsMsg', 'Please provide both an issue title and a description.')
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const cleanDescriptionWithEquipment = equipment
        ? `${cleanDescription}\n\n[Equipment: ${equipment.name} | Product ID: ${equipment.product_id} | Model: ${equipment.model || 'N/A'} | Location: ${equipment.location}]`
        : cleanDescription;

      const created = await MaintenanceService.createMaintenanceRequest(user.id, {
        title: cleanTitle,
        description: cleanDescriptionWithEquipment,
        priority,
        photos,
        equipment_id: equipment?.id || null,
        product_id: equipment?.product_id || null,
      });

      const staffName = created.assignee?.full_name || created.assignee?.email;
      const message = staffName
        ? `${t('createRequest.alerts.autoAssignedPrefix', 'Your request has been submitted and automatically assigned to technician')} ${staffName}!`
        : t('createRequest.alerts.queuedMsg', 'Your request has been submitted and added to the dispatch queue!');

      showAlert(t('createRequest.alerts.successTitle', 'Request Created! 🎉'), message, () => {
        router.replace('/user/dashboard');
      });
    } catch (err: any) {
      console.error('Submit error:', err);
      showAlert(t('createRequest.alerts.submissionNoticeTitle', 'Submission Notice'), err?.message || 'Could not submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const priorityLabels: Record<Priority, string> = {
    low: t('priority.low', 'LOW'),
    medium: t('priority.medium', 'STANDARD'),
    high: t('priority.high', 'HIGH'),
    urgent: t('priority.emergency', 'URGENT'),
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ExecutiveHeader
        title={t('createRequest.headerTitle', 'New Maintenance Request')}
        subtitle={t('createRequest.headerSubtitle', 'Facility Maintenance Dispatch')}
        showBack={true}
        fallbackRoute="/user/dashboard"
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
            {/* Equipment Tag Card (if identified) OR QR Scanner Prompt Banner */}
            {equipment ? (
              <EquipmentTagCard
                equipment={equipment}
                onClear={() => setEquipment(null)}
              />
            ) : (
              <View style={styles.qrBannerCard}>
                <View style={styles.qrBannerLeft}>
                  <View style={styles.qrIconWrap}>
                    <Ionicons name="qr-code" size={22} color="#111111" />
                  </View>
                  <View style={styles.qrBannerTextWrap}>
                    <Text style={styles.qrBannerTitle}>{t('equipment.scanBannerTitle', 'Fast Ticket with QR Code')}</Text>
                    <Text style={styles.qrBannerSub}>
                      {t('equipment.scanBannerSub', 'Scan the QR tag on your fan, AC, or tap to auto-fill asset details')}
                    </Text>
                  </View>
                </View>

                <View style={styles.qrActionBtns}>
                  <Pressable
                    style={({ pressed }) => [styles.scanActionBtn, pressed && styles.pressed]}
                    onPress={() => setScannerVisible(true)}
                  >
                    <Ionicons name="camera" size={15} color="#111111" />
                    <Text style={styles.scanActionBtnText}>{t('equipment.scanQrBtn', 'Scan Equipment QR')}</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.viewSheetBtn, pressed && styles.pressed]}
                    onPress={() => setAssetSheetVisible(true)}
                  >
                    <Ionicons name="list-outline" size={15} color={ExecutiveTheme.colors.brandPrimary} />
                    <Text style={styles.viewSheetBtnText}>{t('equipment.assetDirectoryTitle', 'Asset Tags')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Quick Issue Selector Chips */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>{t('createRequest.quickCommonTitle', 'QUICK SELECT COMMON ISSUE')}</Text>
              <View style={styles.presetGrid}>
                {presetIssues.map((preset, idx) => (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}
                    onPress={() => handleSelectPreset(preset)}
                  >
                    <Ionicons name={preset.icon} size={13} color={ExecutiveTheme.colors.brandPrimary} />
                    <Text style={styles.presetChipText}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Issue Information Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>{t('createRequest.scopeTitle', 'MAINTENANCE WORK SCOPE')}</Text>

              <Text style={styles.fieldLabel}>{t('createRequest.issueTitleLabel', 'ISSUE TITLE *')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('createRequest.issueTitlePlaceholder', 'e.g. Ceiling Fan Not Working')}
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>{t('createRequest.descLabel', 'DETAILED DESCRIPTION *')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={t('createRequest.descPlaceholder', 'Describe the issue, location in apartment, and when it started...')}
                placeholderTextColor={ExecutiveTheme.colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Priority Selector */}
              <Text style={styles.fieldLabel}>{t('createRequest.priorityLabel', 'PRIORITY LEVEL')}</Text>
              <View style={styles.priorityRow}>
                {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <Pressable
                      key={p}
                      style={[
                        styles.priorityChip,
                        isSelected && styles.priorityChipSelected,
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityChipText,
                          isSelected && styles.priorityChipTextSelected,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {priorityLabels[p].toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* AI Smart Triage Assistant */}
            <View style={styles.card}>
              <View style={styles.aiHeaderRow}>
                <Text style={styles.sectionHeader}>{t('createRequest.aiTitle', 'AI SMART TRIAGE ASSISTANT')}</Text>
                <Pressable
                  style={({ pressed }) => [styles.aiBtn, pressed && styles.pressed]}
                  onPress={handleAiTriage}
                  disabled={aiAnalyzing}
                >
                  {aiAnalyzing ? (
                    <ActivityIndicator size="small" color={ExecutiveTheme.colors.brandPrimary} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="sparkles" size={13} color={ExecutiveTheme.colors.brandPrimary} />
                      <Text style={styles.aiBtnText}>{t('createRequest.analyzeBtn', 'Analyze Issue')}</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {aiResult ? (
                <View style={styles.aiResultCard}>
                  <View style={styles.aiResultHeader}>
                    <Text style={styles.aiCategory}>{aiResult.category}</Text>
                    <Text style={styles.aiDuration}>⏳ {aiResult.estimatedDuration}</Text>
                  </View>
                  <Text style={styles.aiExplanation}>{aiResult.explanation}</Text>
                  <View style={styles.aiBenchmarkRow}>
                    <Text style={styles.aiBenchmarkLabel}>{t('createRequest.estimatedCostBenchmark', 'Estimated Cost Range (₹):')}</Text>
                    <Text style={styles.aiBenchmarkValue}>{aiResult.estimatedCostRange}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.aiPromptText}>
                  {t('createRequest.aiInitialPrompt', 'Tap "Analyze Issue" to automatically predict trade category, priority, and estimated repair cost benchmark in ₹ INR.')}
                </Text>
              )}
            </View>

            {/* Photo Evidence Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>
                {t('createRequest.photosTitle', 'EVIDENCE & PHOTOS')} ({photos.length})
              </Text>

              <View style={styles.photoActionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.photoActionBtn, pressed && styles.pressed]}
                  onPress={pickPhotos}
                >
                  <Ionicons name="images-outline" size={16} color={ExecutiveTheme.colors.textPrimary} />
                  <Text style={styles.photoActionBtnText}>{t('createRequest.uploadPhotosBtn', 'Upload Photos')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.photoActionBtn, pressed && styles.pressed]}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera-outline" size={16} color={ExecutiveTheme.colors.textPrimary} />
                  <Text style={styles.photoActionBtnText}>{t('createRequest.openCameraBtn', 'Open Camera')}</Text>
                </Pressable>
              </View>

              {photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {photos.map((p, idx) => (
                    <View key={idx} style={styles.photoThumbContainer}>
                      <Image source={{ uri: p.uri }} style={styles.photoThumb} contentFit="cover" />
                      <Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(idx)}>
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.pressed,
                submitting && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="send" size={15} color="#111111" />
                  <Text style={styles.submitBtnText}>{t('createRequest.submitBtn', 'Submit Maintenance Request')}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 4-Tab Bottom Navigation */}
      <AppBottomNav activeTab="create" role="user" />

      {/* QR Scanner Modal */}
      <QrScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanSuccess={(eq) => handleEquipmentIdentified(eq)}
        onOpenAssetDirectory={() => setAssetSheetVisible(true)}
      />

      {/* Printable QR Asset Tag Sheet Modal */}
      <EquipmentQrSheetModal
        visible={assetSheetVisible}
        onClose={() => setAssetSheetVisible(false)}
        onSelectEquipment={(eq) => handleEquipmentIdentified(eq)}
      />
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
    paddingBottom: 90,
  },
  container: {
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    gap: 14,
  },
  qrBannerCard: {
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
  },
  qrBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBannerTextWrap: {
    flex: 1,
  },
  qrBannerTitle: {
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
  qrBannerSub: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1.5,
    lineHeight: 14,
  },
  qrHeroSub: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1.5,
    lineHeight: 14,
  },
  qrActionBtns: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  scanActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    height: 38,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  scanActionBtnText: {
    color: '#111111',
    fontSize: 11.5,
    fontWeight: '800',
  },
  viewSheetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: ExecutiveTheme.colors.surfaceElevated,
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  viewSheetBtnText: {
    color: '#F5C400',
    fontSize: 11.5,
    fontWeight: '700',
  },
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 22,
    paddingHorizontal: 14,
    minHeight: 44,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14.5,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  priorityChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  priorityChipSelected: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderColor: ExecutiveTheme.colors.brandPrimary,
    elevation: 2,
  },
  priorityChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
    textAlign: 'center',
  },
  priorityChipTextSelected: {
    color: '#111111',
    fontWeight: '800',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiBtn: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  aiBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F5C400',
  },
  aiResultCard: {
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  aiResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aiCategory: {
    fontSize: 13,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
  },
  aiDuration: {
    fontSize: 12,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  aiExplanation: {
    fontSize: 12.5,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 17,
    marginVertical: 4,
  },
  aiBenchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.8,
    borderTopColor: ExecutiveTheme.colors.border,
  },
  aiBenchmarkLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textSecondary,
  },
  aiBenchmarkValue: {
    fontSize: 12,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  aiPromptText: {
    fontSize: 12,
    color: ExecutiveTheme.colors.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    minHeight: 46,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  photoActionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  photoScroll: {
    marginTop: 6,
  },
  photoThumbContainer: {
    position: 'relative',
    marginRight: 10,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#E5E5E5',
    fontSize: 10,
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  submitBtnText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnDisabled: {
    backgroundColor: '#4A4A4A',
  },
  pressed: {
    opacity: 0.75,
  },
});
