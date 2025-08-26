import { useQuery } from '@tanstack/react-query';
import { exchangeApi } from '../services/api';

export interface ExchangeRate {
  rate: number;
  timestamp: string;
  source: string;
}

export const useExchangeRate = () => {
  const {
    data: rate,
    isLoading,
    error,
    refetch
  } = useQuery<ExchangeRate>(['exchange-rate'], exchangeApi.getCurrentRate, {
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000 // Consider data stale after 30 seconds
  });

  return {
    rate,
    isLoading,
    error,
    refetch
  };
};
