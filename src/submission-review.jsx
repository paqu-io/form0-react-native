import { useTheme } from './theme-context.jsx';
import React, { useMemo } from 'react';
import { Modal, View, ScrollView, Pressable } from 'react-native';
import { Text } from './typography.jsx';
import {
  createChangeLabels,
  displaySubmissionValue,
  submissionMessages,
} from './utils/submission-presentation.js';
export { submissionMessages } from './utils/submission-presentation.js';

export function SubmissionReview({ state, schema, snapshot, messages: overrides }) {
  const { theme } = useTheme();
  const messages = { ...submissionMessages, ...overrides };
  const label = useMemo(
    () => (state.review ? createChangeLabels(schema, snapshot) : () => ''),
    [schema, snapshot]
  );
  const review = state.review;
  if (!review) return null;
  const button = (text, action, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={action}
      style={{ padding: 12, opacity: disabled ? 0.4 : 1 }}
    >
      <Text>{text}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => state.choose('cancel')}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#0008',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            backgroundColor: theme.color.background,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text accessibilityRole="header">{messages.title}</Text>
          <Text>{messages.explanation}</Text>
          <Text>
            {review.childChangeCount} {messages.childCalculations} · {review.changeCount}{' '}
            {messages.totalChanges}
          </Text>
          <ScrollView>
            {(review.page?.changes || []).map((change, index) => (
              <View key={review.offset + index} style={{ paddingVertical: 8 }}>
                <Text>{label(change)}</Text>
                <Text>
                  {displaySubmissionValue(change.before)} → {displaySubmissionValue(change.after)}
                </Text>
              </View>
            ))}
          </ScrollView>
          {review.page?.issues?.length ? (
            <Text accessibilityRole="alert">{review.page.issues[0].message}</Text>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            {button(
              messages.previous,
              () => state.page(Math.max(0, review.offset - 50)),
              !review.offset
            )}
            {button(
              messages.next,
              () => state.page(review.offset + 50),
              review.offset + 50 >= review.changeCount
            )}
          </View>
          {button(messages.refresh, () => state.choose('refresh'))}
          {review.choices.includes('retain')
            ? button(messages.retain, () => state.choose('retain'))
            : null}
          {button(messages.cancel, () => state.choose('cancel'))}
        </View>
      </View>
    </Modal>
  );
}
