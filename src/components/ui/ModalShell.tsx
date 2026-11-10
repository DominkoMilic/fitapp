import { type ReactNode, useEffect, useState } from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  Modal,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/** Longest we wait for the final window size before showing the content anyway. */
const READY_FALLBACK_MS = 250;

/**
 * Full-screen modal window for sheets and dialogs. Its content (and so its entering animation)
 * starts only once the window has its final size: on Android the modal window is first laid out
 * above the navigation bar and then grows under it, which made sheets jump ~one gesture-bar
 * height as they finished sliding in. Animations are left to the content (Reanimated); the
 * native Modal animation is off. Also provides the gesture root a Modal needs on Android.
 */
export function ModalShell({
  visible,
  onRequestClose,
  style,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  // Each opening waits again (adjusting state during render, React's alternative to an effect).
  if (!visible && ready) setReady(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setReady(true), READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    // Full screen (under the status and navigation bars) is the final layout.
    if (e.nativeEvent.layout.height >= Dimensions.get('screen').height - 1) setReady(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={[styles.fill, style]} onLayout={onLayout}>
        {ready ? children : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
