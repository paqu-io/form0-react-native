import React from 'react';
import { Text, View } from 'react-native';

export function PlaceholderFieldComponent({ field }) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#666' }}>
        {field?.label || field?.data_name || 'This field'} is not supported on mobile yet.
      </Text>
    </View>
  );
}
