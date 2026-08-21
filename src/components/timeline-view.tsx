import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ExecutiveTheme } from '@/constants/theme';
import { TimelineLog } from '@/types/maintenance';

interface TimelineViewProps {
  logs: TimelineLog[];
}

export function TimelineView({ logs }: TimelineViewProps) {
  if (!logs || logs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No timeline activity recorded yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {logs.map((log, index) => {
        const isLast = index === logs.length - 1;
        const iconInfo = getActionIcon(log.action, log.status);
        const formattedDate = formatTimestamp(log.created_at);

        return (
          <View key={log.id || index} style={styles.itemRow}>
            {/* Left track line & indicator circle */}
            <View style={styles.trackColumn}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: iconInfo.bgColor, borderColor: iconInfo.color },
                ]}
              >
                <Text style={styles.dotIcon}>{iconInfo.icon}</Text>
              </View>
              {!isLast && <View style={styles.line} />}
            </View>

            {/* Right content */}
            <View style={[styles.contentBlock, !isLast && styles.contentMargin]}>
              <View style={styles.headerRow}>
                <Text style={styles.actionTitle}>{iconInfo.title}</Text>
                <Text style={styles.timestamp}>{formattedDate}</Text>
              </View>

              {log.notes ? (
                <Text style={styles.notesText}>{log.notes}</Text>
              ) : null}

              {log.actor?.full_name ? (
                <Text style={styles.actorText}>
                  By {log.actor.full_name} ({log.actor.role === 'maintenance_staff' ? 'Staff' : 'User'})
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function getActionIcon(action: string, status?: string | null) {
  switch (action) {
    case 'created':
      return {
        icon: '📝',
        title: 'Request Created',
        color: '#2563EB',
        bgColor: '#EFF6FF',
      };
    case 'assigned':
      return {
        icon: '👤',
        title: 'Assigned to Staff',
        color: '#7C3AED',
        bgColor: '#F5F3FF',
      };
    case 'status_changed':
      if (status === 'completed') {
        return {
          icon: '✅',
          title: 'Marked Completed',
          color: '#059669',
          bgColor: '#ECFDF5',
        };
      }
      if (status === 'in_progress') {
        return {
          icon: '🔧',
          title: 'Work In Progress',
          color: '#7C3AED',
          bgColor: '#F5F3FF',
        };
      }
      if (status === 'on_hold') {
        return {
          icon: '⏸️',
          title: 'Placed On Hold',
          color: '#EA580C',
          bgColor: '#FFF7ED',
        };
      }
      return {
        icon: '🔄',
        title: `Status: ${status || 'Updated'}`,
        color: '#4B5563',
        bgColor: '#F3F4F6',
      };
    case 'note_added':
      return {
        icon: '💬',
        title: 'Technician Note',
        color: '#0284C7',
        bgColor: '#F0F9FF',
      };
    case 'time_logged':
      return {
        icon: '⏱️',
        title: 'Time Logged',
        color: '#4F46E5',
        bgColor: '#EEF2FF',
      };
    case 'photo_uploaded':
      return {
        icon: '📷',
        title: 'Photo Uploaded',
        color: '#D97706',
        bgColor: '#FEF3C7',
      };
    case 'details_updated':
      return {
        icon: '📋',
        title: 'Repair Details Updated',
        color: '#0D9488',
        bgColor: '#F0FDFA',
      };
    default:
      return {
        icon: '📌',
        title: action.replace('_', ' ').toUpperCase(),
        color: '#6B7280',
        bgColor: '#F9FAFB',
      };
  }
}

function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  itemRow: {
    flexDirection: 'row',
  },
  trackColumn: {
    alignItems: 'center',
    width: 36,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dotIcon: {
    fontSize: 14,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  contentBlock: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 4,
  },
  contentMargin: {
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: ExecutiveTheme.colors.textPrimary,
  },
  timestamp: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textMuted,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
    color: ExecutiveTheme.colors.textSecondary,
    backgroundColor: ExecutiveTheme.colors.backgroundSubtle,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ExecutiveTheme.colors.border,
    marginTop: 4,
  },
  actorText: {
    fontSize: 11.5,
    color: ExecutiveTheme.colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
