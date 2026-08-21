import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';
import { Priority, RequestStatus } from '@/types/maintenance';

interface StatusBadgeProps {
  status: RequestStatus;
  size?: 'small' | 'medium' | 'large';
}

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const config = getStatusConfig(status);

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
  const config = getPriorityConfig(priority);

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

function getStatusConfig(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending Assignment',
        textColor: ExecutiveTheme.colors.statusPendingText,
        bgColor: ExecutiveTheme.colors.statusPendingBg,
        borderColor: ExecutiveTheme.colors.statusPendingBorder,
        dotColor: '#64748B',
      };
    case 'assigned':
      return {
        label: 'Assigned',
        textColor: ExecutiveTheme.colors.statusAssignedText,
        bgColor: ExecutiveTheme.colors.statusAssignedBg,
        borderColor: ExecutiveTheme.colors.statusAssignedBorder,
        dotColor: '#475569',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        textColor: ExecutiveTheme.colors.statusProgressText,
        bgColor: ExecutiveTheme.colors.statusProgressBg,
        borderColor: ExecutiveTheme.colors.statusProgressBorder,
        dotColor: '#D97706',
      };
    case 'on_hold':
      return {
        label: 'On Hold',
        textColor: ExecutiveTheme.colors.statusHoldText,
        bgColor: ExecutiveTheme.colors.statusHoldBg,
        borderColor: ExecutiveTheme.colors.statusHoldBorder,
        dotColor: '#EA580C',
      };
    case 'completed':
      return {
        label: 'Resolved',
        textColor: ExecutiveTheme.colors.statusCompletedText,
        bgColor: ExecutiveTheme.colors.statusCompletedBg,
        borderColor: ExecutiveTheme.colors.statusCompletedBorder,
        dotColor: '#16A34A',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        textColor: '#64748B',
        bgColor: '#F1F5F9',
        borderColor: '#E2E8F0',
        dotColor: '#94A3B8',
      };
    default:
      return {
        label: String(status).toUpperCase(),
        textColor: '#475569',
        bgColor: '#F1F5F9',
        borderColor: '#E2E8F0',
        dotColor: '#64748B',
      };
  }
}

function getPriorityConfig(priority: Priority) {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Urgent',
        textColor: ExecutiveTheme.colors.statusUrgentText,
        bgColor: ExecutiveTheme.colors.statusUrgentBg,
        borderColor: ExecutiveTheme.colors.statusUrgentBorder,
      };
    case 'high':
      return {
        label: 'High Priority',
        textColor: '#9A3412',
        bgColor: '#FFEDD5',
        borderColor: '#FED7AA',
      };
    case 'medium':
      return {
        label: 'Standard',
        textColor: '#854D0E',
        bgColor: '#FEF9C3',
        borderColor: '#FEF08A',
      };
    case 'low':
      return {
        label: 'Low Priority',
        textColor: '#334155',
        bgColor: '#F1F5F9',
        borderColor: '#E2E8F0',
      };
    default:
      return {
        label: String(priority).toUpperCase(),
        textColor: '#475569',
        bgColor: '#F1F5F9',
        borderColor: '#E2E8F0',
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
