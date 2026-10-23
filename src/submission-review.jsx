import { useTheme } from './theme-context.jsx';
import React, { useMemo } from 'react';
import { Modal, View, ScrollView } from 'react-native';
import { Text } from './typography.jsx';
import { FormActionButton } from './form-action-button.jsx';
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
  const button = (id, label, onPress, disabled = false, variant = 'cancel') => (
    <FormActionButton action={{ id, label, onPress, disabled, variant }} theme={theme} />
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
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginVertical: 12,
            }}
          >
            {button(
              'previous',
              messages.previous,
              () => state.page(Math.max(0, review.offset - 50)),
              !review.offset
            )}
            {button(
              'next',
              messages.next,
              () => state.page(review.offset + 50),
              review.offset + 50 >= review.changeCount
            )}
          </View>
          <View style={{ gap: 8 }}>
            {button('refresh', messages.refresh, () => state.choose('refresh'), false, 'primary')}
            {review.choices.includes('retain')
              ? button('retain', messages.retain, () => state.choose('retain'))
              : null}
            {button('cancel', messages.cancel, () => state.choose('cancel'))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
