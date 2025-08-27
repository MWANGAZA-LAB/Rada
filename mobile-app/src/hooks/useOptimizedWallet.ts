import { useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '../services/api';
import { WalletBalance } from './useWallet';

interface UseOptimizedWalletOptions {
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
  retryAttempts?: number;
}

export const useOptimizedWallet = (options: UseOptimizedWalletOptions = {}) => {
  const {
    refetchInterval = 60000, // 1 minute
    staleTime = 30000, // 30 seconds
    cacheTime = 300000, // 5 minutes
    retryAttempts = 3
  } = options;

  const queryClient = useQueryClient();
  const lastFetchTime = useRef<number>(0);

  const {
    data: balance,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery<WalletBalance>({
    queryKey: ['wallet-balance'],
    queryFn: walletApi.getBalance,
    refetchInterval,
    staleTime,
    gcTime: cacheTime, // React Query v5 uses gcTime instead of cacheTime
    retry: retryAttempts,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });

  // Memoized formatted balance to prevent unnecessary re-renders
  const formattedBalance = useMemo(() => {
    if (!balance) return null;

    const formatSatoshi = (satoshi: number): string => {
      return (satoshi / 100000000).toFixed(8);
    };

    return {
      confirmed: formatSatoshi(balance.confirmedBalance),
      unconfirmed: formatSatoshi(balance.unconfirmedBalance),
      total: formatSatoshi(balance.totalBalance),
      raw: balance
    };
  }, [balance]);

  // Optimized refresh function with debouncing
  const refreshBalance = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    
    // Prevent rapid successive calls
    if (timeSinceLastFetch < 5000) {
      console.log('Skipping refresh - too soon since last fetch');
      return;
    }

    try {
      lastFetchTime.current = now;
      await refetch();
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [refetch]);

  // Force refresh function for manual updates
  const forceRefresh = useCallback(async () => {
    try {
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      await refetch();
    } catch (error) {
      console.error('Failed to force refresh balance:', error);
    }
  }, [queryClient, refetch]);

  // Prefetch balance data
  const prefetchBalance = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['wallet-balance'],
      queryFn: walletApi.getBalance,
      staleTime: 30000
    });
  }, [queryClient]);

  // Get balance in different currencies
  const getBalanceInCurrency = useCallback((currency: 'BTC' | 'sats' | 'USD') => {
    if (!balance) return null;

    switch (currency) {
      case 'BTC':
        return balance.totalBalance / 100000000;
      case 'sats':
        return balance.totalBalance;
      case 'USD':
        // This would need exchange rate data
        return null;
      default:
        return null;
    }
  }, [balance]);

  // Check if balance has changed
  const hasBalanceChanged = useCallback((previousBalance: WalletBalance | null) => {
    if (!balance || !previousBalance) return false;
    
    return (
      balance.confirmedBalance !== previousBalance.confirmedBalance ||
      balance.unconfirmedBalance !== previousBalance.unconfirmedBalance ||
      balance.totalBalance !== previousBalance.totalBalance
    );
  }, [balance]);

  return {
    balance: formattedBalance,
    rawBalance: balance,
    isLoading,
    isFetching,
    error,
    refreshBalance,
    forceRefresh,
    prefetchBalance,
    getBalanceInCurrency,
    hasBalanceChanged,
    lastFetchTime: lastFetchTime.current
  };
};
