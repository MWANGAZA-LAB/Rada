import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { usePayment } from '../../hooks/usePayment';
import { useMerchant } from '../../hooks/useMerchant';
import { PaymentInput } from '../common/PaymentInput';
import { MerchantDetails } from '../merchant/MerchantDetails';
import { PaymentConfirmation } from './PaymentConfirmation';
import { ErrorMessage } from '../common/ErrorMessage';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { formatKESAmount } from '../../utils/formatters';
import { validateAmount } from '../../utils/validators';

export const PaymentScreen = ({ route, navigation }) => {
  const { merchantId } = route.params;
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);

  const { 
    merchant, 
    isLoading: isMerchantLoading 
  } = useMerchant(merchantId);

  const { 
    initiatePayment, 
    isLoading: isPaymentLoading 
  } = usePayment();

  const handleAmountChange = useCallback((value) => {
    setError(null);
    setAmount(value.replace(/[^0-9]/g, ''));
  }, []);

  const handlePayment = useCallback(async () => {
    try {
      setError(null);

      if (!validateAmount(Number(amount))) {
        setError('Please enter a valid amount between 10 and 150,000 KES');
        return;
      }

      const result = await initiatePayment({
        merchantId,
        amount: Number(amount),
      });

      navigation.navigate('PaymentConfirmation', {
        transactionId: result.transactionId,
        amount: amount,
        merchantName: merchant.businessName
      });
    } catch (err) {
      setError(err.message || 'Payment initiation failed. Please try again.');
    }
  }, [amount, merchantId, merchant, initiatePayment, navigation]);

  if (isMerchantLoading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <MerchantDetails merchant={merchant} />
      
      <PaymentInput
        value={amount}
        onChangeText={handleAmountChange}
        placeholder="Enter amount in KES"
        keyboardType="numeric"
        maxLength={6}
        testID="payment-amount-input"
      />

      {amount && (
        <Text style={styles.conversionText}>
          Approximately {formatKESAmount(amount)} KES
        </Text>
      )}

      {error && (
        <ErrorMessage message={error} />
      )}

      <Button
        title={isPaymentLoading ? 'Processing...' : 'Pay Now'}
        onPress={handlePayment}
        disabled={isPaymentLoading || !amount}
        style={styles.payButton}
        testID="pay-now-button"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  conversionText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  payButton: {
    marginTop: 20,
  },
});
