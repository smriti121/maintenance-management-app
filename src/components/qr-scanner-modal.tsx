import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
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
  TextInput,
  View,
} from 'react-native';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { EquipmentService, SEED_EQUIPMENT } from '@/services/equipment-service';
import { Equipment } from '@/types/maintenance';
import { showAlert } from '@/utils/alert';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (equipment: Equipment) => void;
  onOpenAssetDirectory?: () => void;
}

export function QrScannerModal({
  visible,
  onClose,
  onScanSuccess,
  onOpenAssetDirectory,
}: QrScannerModalProps) {
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setHasScanned(false);
      setIsProcessing(false);
      setManualCode('');
    }
  }, [visible]);

  async function handleCodeIdentified(rawCode: string) {
    if (isProcessing || hasScanned || !rawCode.trim()) return;
    setIsProcessing(true);
    setHasScanned(true);

    try {
      const equipment = await EquipmentService.getEquipmentByProductId(rawCode);
      if (equipment) {
        onScanSuccess(equipment);
        onClose();
      } else {
        showAlert(
          t('qrScanner.notFoundTitle', 'Equipment Not Found'),
          t(
            'qrScanner.notFoundMessage',
            'No equipment found matching this product ID. Please verify the code or enter manually.'
          )
        );
        setHasScanned(false);
      }
    } catch (err) {
      console.warn('Scan lookup error:', err);
      setHasScanned(false);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (!hasScanned && !isProcessing && data) {
      handleCodeIdentified(data);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Top Header Bar */}
        <View style={styles.headerWrapper}>
          <View style={styles.topHeader}>
            <Pressable
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.iconPressed]}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>{t('qrScanner.title', 'SCAN EQUIPMENT QR CODE')}</Text>
              <Text style={styles.headerSubtitle}>
                {t('qrScanner.subtitle', 'Point your camera at the asset QR tag')}
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  torch && styles.headerIconBtnActive,
                  pressed && styles.iconPressed,
                ]}
                onPress={() => setTorch(!torch)}
                hitSlop={10}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-outline'}
                  size={20}
                  color={torch ? '#F5C400' : '#FFFFFF'}
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.headerIconBtn, pressed && styles.iconPressed]}
                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                hitSlop={10}
              >
                <Ionicons name="camera-reverse-outline" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollStyle}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Camera View Area */}
          <View style={styles.cameraContainer}>
            {permission && permission.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                enableTorch={torch}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
              >
                {/* Target Frame Overlay */}
                <View style={styles.overlayContainer}>
                  <View style={styles.reticleBox}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                    {isProcessing ? (
                      <View style={styles.processingPill}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.processingText}>
                          {t('qrScanner.scanningNotice', 'Searching Supabase Asset Registry...')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.scanPromptPill}>
                        <Ionicons name="scan" size={14} color="#FFFFFF" />
                        <Text style={styles.scanPromptText}>
                          {t('qrScanner.scanPrompt', 'Align QR code within frame')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </CameraView>
            ) : (
              <View style={styles.permissionBox}>
                <Ionicons name="camera-outline" size={44} color="#94A3B8" />
                <Text style={styles.permissionTitle}>
                  {t('qrScanner.permissionTitle', 'Camera Permission Needed')}
                </Text>
                <Text style={styles.permissionPrompt}>
                  {t(
                    'qrScanner.permissionPrompt',
                    'FixFlow requires camera access to scan equipment QR codes.'
                  )}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.permissionBtn, pressed && styles.iconPressed]}
                  onPress={requestPermission}
                >
                  <Text style={styles.permissionBtnText}>
                    {t('qrScanner.grantPermission', 'Grant Camera Permission')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Manual Entry Section */}
          <View style={styles.manualCard}>
            <Text style={styles.manualCardTitle}>
              {t('qrScanner.manualEntryTitle', 'Manual Product ID Entry')}
            </Text>
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                placeholder={t('qrScanner.manualPlaceholder', 'e.g. FAN-204-01, AC-101-02')}
                placeholderTextColor="#94A3B8"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.lookupBtn,
                  pressed && styles.iconPressed,
                  (!manualCode.trim() || isProcessing) && styles.lookupBtnDisabled,
                ]}
                onPress={() => handleCodeIdentified(manualCode)}
                disabled={!manualCode.trim() || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.lookupBtnText}>{t('qrScanner.lookupBtn', 'Identify')}</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Quick Test Pre-configured Asset Picker */}
          <View style={styles.quickTestSection}>
            <View style={styles.quickTestHeaderRow}>
              <View>
                <Text style={styles.quickTestTitle}>
                  {t('qrScanner.quickTestTitle', 'SAMPLE FACILITY ASSET QR CODES')}
                </Text>
                <Text style={styles.quickTestSub}>
                  {t(
                    'qrScanner.quickTestSub',
                    'Tap any pre-configured equipment to test instant identification'
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.sampleGrid}>
              {SEED_EQUIPMENT.map((item) => (
                <Pressable
                  key={item.product_id}
                  style={({ pressed }) => [styles.sampleChip, pressed && styles.sampleChipPressed]}
                  onPress={() => handleCodeIdentified(item.product_id)}
                >
                  <View style={styles.sampleChipTop}>
                    <Text style={styles.sampleChipCode}>{item.product_id}</Text>
                    <Text style={styles.sampleChipCategory}>{item.category}</Text>
                  </View>
                  <Text style={styles.sampleChipName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sampleChipLocation}>📍 {item.location}</Text>
                </Pressable>
              ))}
            </View>

            {onOpenAssetDirectory && (
              <Pressable
                style={({ pressed }) => [styles.assetSheetBtn, pressed && styles.iconPressed]}
                onPress={() => {
                  onClose();
                  onOpenAssetDirectory();
                }}
              >
                <Ionicons name="qr-code-outline" size={16} color={ExecutiveTheme.colors.brandPrimary} />
                <Text style={styles.assetSheetBtnText}>
                  {t('qrScanner.viewAssetSheet', 'View Printable QR Asset Tags')}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111111',
  },
  headerWrapper: {
    width: '100%',
    backgroundColor: '#202020',
    borderBottomWidth: 1,
    borderBottomColor: '#2B2B2B',
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    backgroundColor: '#202020',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#2B2B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtnActive: {
    backgroundColor: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  iconPressed: {
    opacity: 0.75,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#E5E5E5',
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollStyle: {
    flex: 1,
    width: '100%',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
    gap: 14,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
  },
  cameraContainer: {
    height: 280,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#4A4A4A',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 190,
    height: 190,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#F5C400',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 6,
  },
  scanPromptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(32, 32, 32, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  scanPromptText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 196, 0, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  processingText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '800',
  },
  permissionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  permissionPrompt: {
    fontSize: 12,
    color: '#E5E5E5',
    textAlign: 'center',
    maxWidth: 240,
  },
  permissionBtn: {
    backgroundColor: '#F5C400',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  permissionBtnText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '800',
  },
  manualCard: {
    backgroundColor: '#202020',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  manualCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#2B2B2B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#4A4A4A',
  },
  lookupBtn: {
    backgroundColor: '#F5C400',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupBtnDisabled: {
    opacity: 0.5,
  },
  lookupBtnText: {
    color: '#111111',
    fontSize: 12.5,
    fontWeight: '800',
  },
  quickTestSection: {
    backgroundColor: '#202020',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    gap: 10,
  },
  quickTestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTestTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#E5E5E5',
    letterSpacing: 0.4,
  },
  quickTestSub: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  sampleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sampleChip: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#2B2B2B',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#4A4A4A',
  },
  sampleChipPressed: {
    backgroundColor: '#202020',
    borderColor: '#F5C400',
  },
  sampleChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sampleChipCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F5C400',
  },
  sampleChipCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E5E5E5',
  },
  sampleChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sampleChipLocation: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  assetSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2B2B2B',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A4A4A',
    marginTop: 4,
  },
  assetSheetBtnText: {
    color: '#F5C400',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
