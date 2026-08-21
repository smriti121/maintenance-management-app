import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
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

import { supabase } from '@/lib/supabase';
import { AiService, AiTriageResult } from '@/services/ai-service';
import { MaintenanceService, SelectedPhotoInput } from '@/services/maintenance-service';
import { Priority } from '@/types/maintenance';
import { showAlert } from '@/utils/alert';

export default function CreateRequestScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [photos, setPhotos] = useState<SelectedPhotoInput[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiTriageResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Smart AI Triage Analysis
  async function handleAiTriage() {
    if (!title.trim() && !description.trim()) {
      showAlert('Enter Details First', 'Please enter an issue title or description for AI analysis.');
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
        showAlert('Permission Required', 'FixFlow requires access to your photo library to attach photos.');
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
      console.error('Error picking photos:', err);
      showAlert('Photo Notice', 'Could not access photos: ' + (err?.message || 'Unknown issue.'));
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
      showAlert('Missing Fields', 'Please provide both an issue title and a description.');
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

      const created = await MaintenanceService.createMaintenanceRequest(user.id, {
        title: cleanTitle,
        description: cleanDescription,
        priority,
        photos,
      });

      const staffName = created.assignee?.full_name || created.assignee?.email;
      const message = staffName
        ? `Your request has been submitted and automatically assigned to technician ${staffName}!`
        : 'Your request has been submitted and added to the dispatch queue!';

      showAlert('Request Created! 🎉', message, () => {
        router.replace('/user/dashboard');
      });
    } catch (err: any) {
      console.error('Submit error:', err);
      showAlert('Submission Notice', err?.message || 'Could not submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* iOS Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.navBackBtn}>
            <Text style={styles.navBackText}>‹</Text>
          </Pressable>
          <Text style={styles.navBarTitle}>New Request</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Section 1: Issue Info Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>ISSUE DETAILS</Text>

              <Text style={styles.inputLabel}>ISSUE TITLE *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Leaking pipe under kitchen sink"
                placeholderTextColor="#8E8E93"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>DETAILED DESCRIPTION *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what happened, where it is located, and any damage noticed..."
                placeholderTextColor="#8E8E93"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Smart AI Triage Button */}
              <Pressable
                style={({ pressed }) => [styles.aiBtn, pressed && styles.pressed]}
                onPress={handleAiTriage}
                disabled={aiAnalyzing}
              >
                {aiAnalyzing ? (
                  <ActivityIndicator size="small" color="#AF52DE" />
                ) : (
                  <>
                    <Text style={styles.aiBtnIcon}>✨</Text>
                    <Text style={styles.aiBtnText}>Run Smart AI Diagnosis</Text>
                  </>
                )}
              </Pressable>

              {/* AI Diagnosis Result Card */}
              {aiResult && (
                <View style={styles.aiResultCard}>
                  <View style={styles.aiResultHeader}>
                    <Text style={styles.aiBadge}>AI ANALYSIS</Text>
                    <Text style={styles.aiCategory}>{aiResult.category}</Text>
                  </View>

                  <Text style={styles.aiExplanation}>{aiResult.explanation}</Text>

                  {aiResult.safetyAdvice && aiResult.safetyAdvice.length > 0 && (
                    <View style={styles.aiSafetyBox}>
                      {aiResult.safetyAdvice.map((advice, i) => (
                        <Text key={i} style={styles.aiSafetyText}>⚠️ {advice}</Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.aiMetaRow}>
                    <Text style={styles.aiMetaText}>
                      Est. Cost: <Text style={{ fontWeight: '700' }}>{aiResult.estimatedCostRange}</Text>
                    </Text>
                    <Text style={styles.aiMetaText}>
                      Rec. Priority: <Text style={{ fontWeight: '700', textTransform: 'uppercase' }}>{aiResult.recommendedPriority}</Text>
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Section 2: Priority Picker Card */}
            <View style={styles.card}>
              <Text style={styles.sectionHeader}>PRIORITY LEVEL</Text>
              <View style={styles.priorityGrid}>
                {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <Pressable
                      key={p}
                      style={[
                        styles.priorityOption,
                        isSelected && styles.priorityOptionActive,
                        isSelected && p === 'urgent' && styles.priorityUrgentActive,
                        isSelected && p === 'high' && styles.priorityHighActive,
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityText,
                          isSelected && styles.priorityTextActive,
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Section 3: Photo Uploads Card */}
            <View style={styles.card}>
              <View style={styles.photoHeaderRow}>
                <Text style={styles.sectionHeader}>ATTACH PHOTOS ({photos.length})</Text>
                <Pressable style={styles.addPhotoSmallBtn} onPress={pickPhotos}>
                  <Text style={styles.addPhotoSmallText}>＋ Add Photos</Text>
                </Pressable>
              </View>

              {photos.length > 0 ? (
                <View style={styles.photoGrid}>
                  {photos.map((p, idx) => (
                    <View key={idx} style={styles.photoWrapper}>
                      <Image source={{ uri: p.uri }} style={styles.photoThumb} contentFit="cover" />
                      <Pressable style={styles.removePhotoBtn} onPress={() => removePhoto(idx)}>
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Pressable style={styles.emptyPhotoBox} onPress={pickPhotos}>
                  <Text style={styles.emptyPhotoIcon}>📷</Text>
                  <Text style={styles.emptyPhotoTitle}>Attach Photos</Text>
                  <Text style={styles.emptyPhotoSub}>
                    Tap to upload photos of the issue for faster diagnosis
                  </Text>
                </Pressable>
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Maintenance Request</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  navBar: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  navBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.3,
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
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FBF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 14,
  },
  aiBtnIcon: {
    fontSize: 16,
  },
  aiBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#AF52DE',
  },
  aiResultCard: {
    marginTop: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  aiResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AF52DE',
    letterSpacing: 0.5,
  },
  aiCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B21A8',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiExplanation: {
    fontSize: 13,
    color: '#4C1D95',
    lineHeight: 18,
    marginBottom: 8,
  },
  aiSafetyBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  aiSafetyText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  aiMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#E9D5FF',
    paddingTop: 8,
  },
  aiMetaText: {
    fontSize: 12,
    color: '#6B21A8',
  },
  priorityGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  priorityOption: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  priorityOptionActive: {
    backgroundColor: '#007AFF',
  },
  priorityHighActive: {
    backgroundColor: '#FF9500',
  },
  priorityUrgentActive: {
    backgroundColor: '#FF3B30',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
  },
  priorityTextActive: {
    color: '#FFFFFF',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoWrapper: {
    width: 76,
    height: 76,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyPhotoBox: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyPhotoIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyPhotoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  emptyPhotoSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    textAlign: 'center',
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    backgroundColor: '#A2CAFC',
  },
  pressed: {
    opacity: 0.85,
  },
});
