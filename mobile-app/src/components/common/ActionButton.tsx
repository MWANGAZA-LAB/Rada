import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface ActionButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onPress,
  testID,
  disabled = false
}) => (
  <TouchableOpacity
    style={[styles.button, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    testID={testID}
  >
    <Icon name={icon} size={24} color="#fff" style={styles.icon} />
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    width: '45%',
  },
  disabled: {
    backgroundColor: '#ccc',
    opacity: 0.7
  },
  icon: {
    marginRight: 8
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
