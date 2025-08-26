import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WalletBalance } from '../../components/wallet/WalletBalance';
import { RecentTransactions } from '../../components/common/RecentTransactions';
import { ExchangeRate } from '../../components/common/ExchangeRate';

import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../../hooks/useWallet';
import { useExchangeRate } from '../../hooks/useExchangeRate';
import { useTransactions } from '../../hooks/useTransactions';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ActionButton } from '../../components/common/ActionButton';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    balance, 
    isLoading: isBalanceLoading,
    refetch: refetchBalance 
  } = useWallet();

  const {
    rate,
    isLoading: isRateLoading,
    refetch: refetchRate
  } = useExchangeRate();

  const {
    transactions,
    isLoading: isTransactionsLoading,
    refetch: refetchTransactions
  } = useTransactions();

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshData = async () => {
        try {
          await Promise.all([
            refetchBalance(),
            refetchRate(),
            refetchTransactions()
          ]);
        } catch (err) {
          setError('Failed to refresh data');
        }
      };

      refreshData();
    }, [refetchBalance, refetchRate, refetchTransactions])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      await Promise.all([
        refetchBalance(),
        refetchRate(),
        refetchTransactions()
      ]);
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [refetchBalance, refetchRate, refetchTransactions]);

  const handleNavigate = React.useCallback((screen: string) => {
    navigation.navigate(screen);
  }, [navigation]);

  if (isBalanceLoading || isRateLoading || isTransactionsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <WalletBalance 
          balance={balance}
          rate={rate}
        />
        
        <ExchangeRate 
          rate={rate}
          lastUpdated={rate?.timestamp}
        />
        
        <View style={styles.actionButtons}>
          <ActionButton
            label="Send"
            icon="send"
            onPress={() => handleNavigate('Send')}
            testID="send-button"
          />
          <ActionButton
            label="Scan"
            icon="qr-code"
            onPress={() => handleNavigate('Scan')}
            testID="scan-button"
          />
        </View>

        <RecentTransactions 
          transactions={transactions}
          onTransactionPress={(id) => handleNavigate('TransactionDetails', { id })}
        />
      </ScrollView>
    </ErrorBoundary>
  );
};
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    width: '40%',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
