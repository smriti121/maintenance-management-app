import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';
import { LanguageCode, useLanguage } from '@/context/language-context';

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  const options: { code: LanguageCode; label: string; subLabel: string; badge: string }[] = [
    {
      code: 'en',
      label: 'English',
      subLabel: t('languageSelector.englishSub', 'Default (EN)'),
      badge: 'EN',
    },
    {
      code: 'hi',
      label: 'हिंदी (Hindi)',
      subLabel: t('languageSelector.hindiSub', 'Official Hindi (HI)'),
      badge: 'हि',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="language-outline" size={18} color={ExecutiveTheme.colors.brandPrimary} />
        </View>
        <View style={styles.titleGroup}>
          <Text style={styles.sectionHeader}>{t('profile.languageSectionTitle', 'LANGUAGE / भाषा')}</Text>
          <Text style={styles.sectionSub}>
            {t('profile.languageSectionSub', 'Choose your preferred application language')}
          </Text>
        </View>
      </View>

      <View style={styles.optionsList}>
        {options.map((opt) => {
          const isSelected = language === opt.code;
          return (
            <Pressable
              key={opt.code}
              style={({ pressed }) => [
                styles.optionRow,
                isSelected && styles.optionRowSelected,
                pressed && styles.pressed,
              ]}
              onPress={() => setLanguage(opt.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={opt.label}
            >
              <View style={[styles.langBadge, isSelected && styles.langBadgeSelected]}>
                <Text style={[styles.langBadgeText, isSelected && styles.langBadgeTextSelected]}>
                  {opt.badge}
                </Text>
              </View>

              <View style={styles.textWrap}>
                <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.subLabel}</Text>
              </View>

              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: ExecutiveTheme.colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textPrimary,
    letterSpacing: 0.4,
  },
  sectionSub: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: ExecutiveTheme.colors.border,
    minHeight: 52,
  },
  optionRowSelected: {
    backgroundColor: ExecutiveTheme.colors.brandLightMuted,
    borderColor: ExecutiveTheme.colors.brandPrimary,
    elevation: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  langBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#202020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
  },
  langBadgeSelected: {
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
    borderColor: ExecutiveTheme.colors.brandPrimary,
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: ExecutiveTheme.colors.textSecondary,
  },
  langBadgeTextSelected: {
    color: '#111111',
  },
  textWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  optionTitleSelected: {
    color: ExecutiveTheme.colors.brandPrimary,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 11,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A4A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: ExecutiveTheme.colors.brandPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ExecutiveTheme.colors.brandPrimary,
  },
});
