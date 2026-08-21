import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
      <View style={[styles.dot, { backgroundColor: config.textColor }]} />
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
        textColor: '#D97706',
        bgColor: '#FEF3C7',
        borderColor: '#FDE68A',
      };
    case 'assigned':
      return {
        label: 'Assigned',
        textColor: '#2563EB',
        bgColor: '#EFF6FF',
        borderColor: '#BFDBFE',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        textColor: '#7C3AED',
        bgColor: '#F5F3FF',
        borderColor: '#DDD6FE',
      };
    case 'on_hold':
      return {
        label: 'On Hold',
        textColor: '#EA580C',
        bgColor: '#FFF7ED',
        borderColor: '#FFEDD5',
      };
    case 'completed':
      return {
        label: 'Completed',
        textColor: '#059669',
        bgColor: '#ECFDF5',
        borderColor: '#A7F3D0',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        textColor: '#DC2626',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
      };
    default:
      return {
        label: status,
        textColor: '#4B5563',
        bgColor: '#F3F4F6',
        borderColor: '#E5E7EB',
      };
  }
}

function getPriorityConfig(priority: Priority) {
  switch (priority) {
    case 'urgent':
      return {
        label: '🔥 Urgent',
        textColor: '#DC2626',
        bgColor: '#FEF2F2',
        borderColor: '#FCA5A5',
      };
    case 'high':
      return {
        label: 'High',
        textColor: '#EA580C',
        bgColor: '#FFF7ED',
        borderColor: '#FDBA74',
      };
    case 'medium':
      return {
        label: 'Medium',
        textColor: '#2563EB',
        bgColor: '#EFF6FF',
        borderColor: '#93C5FD',
      };
    case 'low':
      return {
        label: 'Low',
        textColor: '#4B5563',
        bgColor: '#F3F4F6',
        borderColor: '#D1D5DB',
      };
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  smallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  largeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 11,
  },
  largeText: {
    fontSize: 14,
  },
});
