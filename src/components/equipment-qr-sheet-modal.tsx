import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { EquipmentService } from '@/services/equipment-service';
import { Equipment } from '@/types/maintenance';

interface EquipmentQrSheetModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectEquipment?: (equipment: Equipment) => void;
}

export function EquipmentQrSheetModal({
  visible,
  onClose,
  onSelectEquipment,
}: EquipmentQrSheetModalProps) {
  const { t } = useLanguage();
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadAssets();
    }
  }, [visible]);

  async function loadAssets() {
    setLoading(true);
    try {
      const items = await EquipmentService.getAllEquipment();
      setEquipmentList(items);
    } catch (err) {
      console.warn('Failed to load equipment list:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#111111" />

        {/* Top Header */}
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>
                {t('equipment.assetDirectoryTitle', 'FACILITY QR ASSET DIRECTORY')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {t(
                  'equipment.assetDirectorySub',
                  'Printable QR code asset tags with unique product identifiers'
                )}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color={ExecutiveTheme.colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={ExecutiveTheme.colors.brandPrimary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.tagGrid}>
              {equipmentList.map((item) => (
                <View key={item.product_id} style={styles.assetTagCard}>
                  {/* QR Code Container */}
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={item.product_id}
                      size={86}
                      color="#111111"
                      backgroundColor="#FFFFFF"
                    />
                    <Text style={styles.qrCodeText}>{item.product_id}</Text>
                  </View>

                  {/* Asset Details */}
                  <View style={styles.assetDetails}>
                    <Text style={styles.assetName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('equipment.categoryLabel', 'Category:')}</Text>
                      <Text style={styles.detailValue}>{item.category}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{t('equipment.locationLabel', 'Location:')}</Text>
                      <Text style={styles.detailValueBold}>📍 {item.location}</Text>
                    </View>

                    {item.model && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{t('equipment.modelLabel', 'Model:')}</Text>
                        <Text style={styles.detailValue}>{item.model}</Text>
                      </View>
                    )}

                    {onSelectEquipment && (
                      <Pressable
                        style={({ pressed }) => [styles.useBtn, pressed && styles.pressed]}
                        onPress={() => {
                          onSelectEquipment(item);
                          onClose();
                        }}
                      >
                        <Ionicons name="checkmark" size={14} color="#111111" />
                        <Text style={styles.useBtnText}>{t('equipment.useQrBtn', 'Use In Request')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ExecutiveTheme.colors.background,
  },
  headerWrapper: {
    width: '100%',
    backgroundColor: ExecutiveTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.borderSubtle,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
    maxWidth: ExecutiveTheme.MaxContentWidth,
    backgroundColor: ExecutiveTheme.colors.surface,
    minHeight: 48,
  },
  headerTitleGroup: {
    flex: 1,
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ExecutiveTheme.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  pressed: {
    opacity: 0.75,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40,
    maxWidth: ExecutiveTheme.MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  tagGrid: {
    gap: 10,
  },
  assetTagCard: {
    flexDirection: 'row',
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    gap: 12,
    alignItems: 'center',
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    width: 104,
  },
  qrCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandPrimary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  assetDetails: {
    flex: 1,
    gap: 3,
  },
  assetName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 10.5,
    color: ExecutiveTheme.colors.textSecondary,
    fontWeight: '600',
    width: 56,
  },
  detailValue: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  detailValueBold: {
    fontSize: 11,
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '700',
    flex: 1,
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  useBtnText: {
    color: '#111111',
    fontSize: 11,
    fontWeight: '800',
  },
});
