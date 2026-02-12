import React, { forwardRef, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const C = {
  charcoal: '#1A1510',
  gold: '#D4AF37',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  background: '#FAFAF8',
  danger: '#E74C3C',
};

const SNAP_POINTS = ['30%'];

interface DayActionMenuProps {
  dateLabel: string;
  hasClipboard: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
}

const DayActionMenu = forwardRef<BottomSheetModal, DayActionMenuProps>(
  ({ dateLabel, hasClipboard, onCopy, onPaste, onClear }, ref) => {
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const dismiss = () => {
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    };

    const handleAction = (action: () => void) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      action();
      dismiss();
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBg}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{dateLabel}</Text>

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            onPress={() => handleAction(onCopy)}
          >
            <Ionicons name="copy-outline" size={20} color={C.charcoal} />
            <Text style={styles.actionText}>Copy This Day's Meals</Text>
          </Pressable>

          {hasClipboard && (
            <Pressable
              style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
              onPress={() => handleAction(onPaste)}
            >
              <Ionicons name="clipboard-outline" size={20} color={C.gold} />
              <Text style={[styles.actionText, { color: C.gold }]}>Paste Meals Here</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}
            onPress={() => handleAction(onClear)}
          >
            <Ionicons name="trash-outline" size={20} color={C.danger} />
            <Text style={[styles.actionText, { color: C.danger }]}>Clear All Meals</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelRow, pressed && { opacity: 0.6 }]}
            onPress={dismiss}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  }
);

DayActionMenu.displayName = 'DayActionMenu';
export default DayActionMenu;

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: C.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: C.hairline,
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  cancelRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.muted,
  },
});
