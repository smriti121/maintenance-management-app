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
        color: '#F5C400',
        bgColor: '#2B2B2B',
      };
    case 'assigned':
      return {
        icon: '👤',
        title: 'Assigned to Staff',
        color: '#F5C400',
        bgColor: '#2B2B2B',
      };
    case 'status_changed':
      if (status === 'completed') {
        return {
          icon: '✅',
          title: 'Marked Completed',
          color: '#F5C400',
          bgColor: '#202020',
        };
      }
      if (status === 'in_progress') {
        return {
          icon: '🔧',
          title: 'Work In Progress',
          color: '#F5C400',
          bgColor: '#202020',
        };
      }
      if (status === 'on_hold') {
        return {
          icon: '⏸️',
          title: 'Placed On Hold',
          color: '#E5E5E5',
          bgColor: '#2B2B2B',
        };
      }
      return {
        icon: '🔄',
        title: `Status: ${status || 'Updated'}`,
        color: '#E5E5E5',
        bgColor: '#2B2B2B',
      };
    case 'note_added':
      return {
        icon: '💬',
        title: 'Technician Note',
        color: '#F5C400',
        bgColor: '#2B2B2B',
      };
    case 'time_logged':
      return {
        icon: '⏱️',
        title: 'Time Logged',
        color: '#F5C400',
        bgColor: '#202020',
      };
    case 'photo_uploaded':
      return {
        icon: '📷',
        title: 'Photo Uploaded',
        color: '#F5C400',
        bgColor: '#2B2B2B',
      };
    case 'details_updated':
      return {
        icon: '📋',
        title: 'Repair Details Updated',
        color: '#F5C400',
        bgColor: '#2B2B2B',
      };
    default:
      return {
        icon: '📌',
        title: action.replace('_', ' ').toUpperCase(),
        color: '#E5E5E5',
        bgColor: '#2B2B2B',
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
    color: ExecutiveTheme.colors.textMuted,
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
    backgroundColor: '#4A4A4A',
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
