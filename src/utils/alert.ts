import { Alert, Platform } from 'react-native';

interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Cross-platform confirmation dialog that works on Web (window.confirm), iOS, and Android (Alert.alert).
 */
export function confirmAction(options: ConfirmActionOptions) {
  const {
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
  } = options;

  if (Platform.OS === 'web') {
    const fullPrompt = `${title}\n\n${message}`;
    if (typeof window !== 'undefined' && window.confirm(fullPrompt)) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(title, message, [
      {
        text: cancelText,
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  }
}

/**
 * Cross-platform notification alert that executes callback on both Web and Native.
 */
export function showAlert(
  title: string,
  message: string,
  onClose?: () => void | Promise<void>
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    if (onClose) {
      onClose();
    }
  } else {
    Alert.alert(title, message, [
      {
        text: 'OK',
        onPress: onClose,
      },
    ]);
  }
}
