import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Equipment } from '@/types/maintenance';

interface EquipmentTagCardProps {
  equipment: Equipment;
  onClear?: () => void;
  readOnly?: boolean;
}

export function EquipmentTagCard({ equipment, onClear, readOnly = false }: EquipmentTagCardProps) {
  const { t } = useLanguage();

  function getCategoryIcon(cat: string) {
    const c = (cat || '').toLowerCase();
    if (c.includes('elect')) return 'flash';
    if (c.includes('fan')) return 'sync';
    if (c.includes('hvac') || c.includes('ac') || c.includes('cool')) return 'snow';
    if (c.includes('plumb') || c.includes('water') || c.includes('tap') || c.includes('pipe')) return 'water';
    return 'hardware-chip';
  }

  function getCategoryColor(cat: string) {
    const c = (cat || '').toLowerCase();
    if (c.includes('elect') || c.includes('fan')) return '#F5C400'; // Yellow
    if (c.includes('hvac') || c.includes('ac') || c.includes('cool')) return '#F5C400'; // Yellow
    if (c.includes('plumb') || c.includes('water') || c.includes('tap') || c.includes('pipe')) return '#E5E5E5'; // Light Grey
    return '#888888';
  }

  const catColor = getCategoryColor(equipment.category);
  const catIcon = getCategoryIcon(equipment.category);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${catColor}20` }]}>
            <Ionicons name={catIcon as any} size={17} color={catColor} />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.sectionTitle}>{t('equipment.sectionTitle', 'IDENTIFIED EQUIPMENT / ASSET')}</Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={13} color="#F5C400" />
              <Text style={styles.verifiedText}>{t('equipment.verifiedDb', 'Verified Asset')}</Text>
            </View>
          </View>
        </View>

        {!readOnly && onClear && (
          <Pressable
            style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear identified equipment"
          >
            <Ionicons name="close" size={14} color="#E5E5E5" />
            <Text style={styles.clearBtnText}>{t('equipment.clearBtn', 'Clear')}</Text>
          </Pressable>
        )}
      </View>

      {/* Main Asset Banner */}
      <View style={styles.mainAssetRow}>
        <Text style={styles.equipmentName} numberOfLines={1}>
          {equipment.name}
        </Text>
      </View>

      {/* Asset Specifications Grid */}
      <View style={styles.specGrid}>
        <View style={styles.specItem}>
          <Text style={styles.specLabel}>{t('equipment.productIdLabel', 'Product ID:')}</Text>
          <View style={styles.productIdBadge}>
            <Text style={styles.productIdText}>{equipment.product_id}</Text>
          </View>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>{t('equipment.categoryLabel', 'Category:')}</Text>
          <Text style={styles.specValue}>{equipment.category}</Text>
        </View>

        <View style={styles.specItem}>
          <Text style={styles.specLabel}>{t('equipment.locationLabel', 'Location:')}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={ExecutiveTheme.colors.brandPrimary} />
            <Text style={styles.specValueBold}>{equipment.location}</Text>
          </View>
        </View>

        {equipment.model && (
          <View style={styles.specItem}>
            <Text style={styles.specLabel}>{t('equipment.modelLabel', 'Model:')}</Text>
            <Text style={styles.specValue}>{equipment.model}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ExecutiveTheme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: ExecutiveTheme.colors.border,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: ExecutiveTheme.colors.borderSubtle,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
    letterSpacing: 0.4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F5C400',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A4A4A',
  },
  clearBtnPressed: {
    opacity: 0.7,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E5E5E5',
  },
  mainAssetRow: {
    marginBottom: 10,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: -0.2,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  specItem: {
    width: '47%',
  },
  specLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: ExecutiveTheme.colors.textSecondary,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  specValueBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.brandPrimary,
  },
  productIdBadge: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  productIdText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#F5C400',
    letterSpacing: 0.4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
