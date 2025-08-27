import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useOptimizedWallet } from '../../hooks/useOptimizedWallet';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';

interface WalletBalanceProps {
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  testID?: string;
}

export const WalletBalance = memo<WalletBalanceProps>(({
  showRefreshButton = true,
  onRefresh,
  testID = 'wallet-balance'
}) => {
  const {
    balance,
    isLoading,
    isFetching,
    error,
    refreshBalance
  } = useOptimizedWallet({
    refetchInterval: 60000, // 1 minute
    staleTime: 30000, // 30 seconds
    retryAttempts: 3
  });

  // Memoized formatted values to prevent unnecessary re-renders
  const formattedValues = useMemo(() => {
    if (!balance) return null;

    return {
      confirmed: balance.confirmed,
      unconfirmed: balance.unconfirmed,
      total: balance.total,
      hasUnconfirmed: parseFloat(balance.unconfirmed) > 0
    };
  }, [balance]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      refreshBalance();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container} testID={`${testID}-loading`}>
        <LoadingSpinner size="small" />
        <Text style={styles.loadingText}>Loading wallet balance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container} testID={`${testID}-error`}>
        <ErrorMessage 
          message="Failed to load wallet balance"
          onRetry={handleRefresh}
        />
      </View>
    );
  }

  if (!formattedValues) {
    return (
      <View style={styles.container} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No balance available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityLabel="Wallet Balance">
          Wallet Balance
        </Text>
        {showRefreshButton && (
          <TouchableOpacity
            style={[styles.refreshButton, isFetching && styles.refreshButtonDisabled]}
            onPress={handleRefresh}
            disabled={isFetching}
            accessibilityLabel="Refresh balance"
            accessibilityHint="Double tap to refresh wallet balance"
            testID={`${testID}-refresh-button`}
          >
            <Text style={styles.refreshButtonText}>
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.balanceContainer}>
        <View style={styles.mainBalance}>
          <Text 
            style={styles.balanceAmount}
            accessibilityLabel={`Total balance: ${formattedValues.total} Bitcoin`}
          >
            {formattedValues.total} BTC
          </Text>
          <Text style={styles.balanceLabel}>Total Balance</Text>
        </View>

        {formattedValues.hasUnconfirmed && (
          <View style={styles.unconfirmedContainer}>
            <Text 
              style={styles.unconfirmedAmount}
              accessibilityLabel={`Unconfirmed balance: ${formattedValues.unconfirmed} Bitcoin`}
            >
              {formattedValues.unconfirmed} BTC
            </Text>
            <Text style={styles.unconfirmedLabel}>Unconfirmed</Text>
          </View>
        )}
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Confirmed:</Text>
          <Text style={styles.detailValue}>
            {formattedValues.confirmed} BTC
          </Text>
        </View>
        
        {formattedValues.hasUnconfirmed && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Unconfirmed:</Text>
            <Text style={[styles.detailValue, styles.unconfirmedValue]}>
              {formattedValues.unconfirmed} BTC
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  refreshButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500'
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: 16
  },
  mainBalance: {
    alignItems: 'center'
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  unconfirmedContainer: {
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  unconfirmedAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
    marginBottom: 2
  },
  unconfirmedLabel: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500'
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600'
  },
  unconfirmedValue: {
    color: '#FF9500'
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center'
  }
});

WalletBalance.displayName = 'WalletBalance';
