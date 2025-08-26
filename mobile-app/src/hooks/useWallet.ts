import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { walletApi } from '../services/api';

export interface WalletBalance {
  confirmedBalance: number;
  unconfirmedBalance: number;
  totalBalance: number;
}

export const useWallet = () => {
  const {
    data: balance,
    isLoading,
    error,
    refetch
  } = useQuery<WalletBalance>(['wallet-balance'], walletApi.getBalance, {
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });

  return {
    balance,
    isLoading,
    error,
    refetch
  };
};
