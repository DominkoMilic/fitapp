import { AccessibilityInfo } from 'react-native';

/**
 * Speaks a message with VoiceOver/TalkBack (audit fix: iOS doesn't announce role="alert" or
 * live regions on its own, so toasts and errors were silent for screen-reader users).
 */
export function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

let screenReaderOn = false;
void AccessibilityInfo.isScreenReaderEnabled().then(
  (on) => (screenReaderOn = on),
  () => undefined,
);
AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReaderOn = on));

export const isScreenReaderOn = () => screenReaderOn;
