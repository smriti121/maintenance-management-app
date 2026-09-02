import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Priority, RequestStatus } from '@/types/maintenance';

interface StatusBadgeProps {
  status: RequestStatus;
  size?: 'small' | 'medium' | 'large';
}

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const { t } = useLanguage();
  const config = getStatusConfig(status, t);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
        size === 'small' && styles.smallBadge,
        size === 'large' && styles.largeBadge,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      <Text
        style={[
          styles.text,
          { color: config.textColor },
          size === 'small' && styles.smallText,
          size === 'large' && styles.largeText,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'small' | 'medium';
}

export function PriorityBadge({ priority, size = 'medium' }: PriorityBadgeProps) {
  const { t } = useLanguage();
  const config = getPriorityConfig(priority, t);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
        size === 'small' && styles.smallBadge,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.textColor },
          size === 'small' && styles.smallText,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

function getStatusConfig(status: RequestStatus, t: (key: string, fb: string) => string) {
  switch (status) {
    case 'pending':
      return {
        label: t('status.pending', 'Pending'),
        textColor: '#E5E5E5',
        bgColor: '#2B2B2B',
        borderColor: '#4A4A4A',
        dotColor: '#888888',
      };
    case 'assigned':
      return {
        label: t('status.assigned', 'Assigned'),
        textColor: '#F5C400',
        bgColor: '#2B2B2B',
        borderColor: '#F5C400',
        dotColor: '#F5C400',
      };
    case 'in_progress':
      return {
        label: t('status.in_progress', 'In Progress'),
        textColor: '#F5C400',
        bgColor: '#202020',
        borderColor: '#F5C400',
        dotColor: '#F5C400',
      };
    case 'on_hold':
      return {
        label: t('status.on_hold', 'On Hold'),
        textColor: '#E5E5E5',
        bgColor: '#2B2B2B',
        borderColor: '#4A4A4A',
        dotColor: '#888888',
      };
    case 'completed':
      return {
        label: t('status.completed', 'Resolved'),
        textColor: '#FFFFFF',
        bgColor: '#202020',
        borderColor: '#4A4A4A',
        dotColor: '#F5C400',
      };
    case 'cancelled':
      return {
        label: t('status.cancelled', 'Cancelled'),
        textColor: '#888888',
        bgColor: '#202020',
        borderColor: '#2B2B2B',
        dotColor: '#4A4A4A',
      };
    default:
      return {
        label: String(status).toUpperCase(),
        textColor: '#E5E5E5',
        bgColor: '#2B2B2B',
        borderColor: '#4A4A4A',
        dotColor: '#888888',
      };
  }
}

function getPriorityConfig(priority: Priority, t: (key: string, fb: string) => string) {
  switch (priority) {
    case 'urgent':
      return {
        label: t('priority.emergency', 'Emergency'),
        textColor: '#111111',
        bgColor: '#F5C400',
        borderColor: '#F5C400',
      };
    case 'high':
      return {
        label: t('priority.high', 'High'),
        textColor: '#F5C400',
        bgColor: '#2B2B2B',
        borderColor: '#F5C400',
      };
    case 'medium':
      return {
        label: t('priority.medium', 'Standard'),
        textColor: '#E5E5E5',
        bgColor: '#202020',
        borderColor: '#4A4A4A',
      };
    case 'low':
      return {
        label: t('priority.low', 'Low'),
        textColor: '#888888',
        bgColor: '#202020',
        borderColor: '#2B2B2B',
      };
    default:
      return {
        label: String(priority).toUpperCase(),
        textColor: '#888888',
        bgColor: '#202020',
        borderColor: '#2B2B2B',
      };
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.8,
    alignSelf: 'flex-start',
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  largeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  smallText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  largeText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
