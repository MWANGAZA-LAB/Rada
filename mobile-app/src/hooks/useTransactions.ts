import { useQuery } from '@tanstack/react-query';
import { transactionApi } from '../services/api';

export interface Transaction {
  id: string;
  amount: number;
  type: 'send' | 'receive';
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  merchantName?: string;
  memo?: string;
}

export const useTransactions = () => {
  const {
    data: transactions,
    isLoading,
    error,
    refetch
  } = useQuery<Transaction[]>(['transactions'], transactionApi.getTransactions, {
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });

  return {
    transactions,
    isLoading,
    error,
    refetch
  };
};
