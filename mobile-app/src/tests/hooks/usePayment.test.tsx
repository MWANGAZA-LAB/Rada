import { renderHook, act } from '@testing-library/react-hooks';
import { usePayment } from '../../hooks/usePayment';
import { PaymentService } from '../../services/payment';

// Mock the payment service
jest.mock('../../services/payment');

describe('usePayment Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initiate payment successfully', async () => {
    const mockResponse = {
      transactionId: 'tx123',
      checkoutRequestId: 'cr123'
    };

    PaymentService.initiatePayment.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => usePayment());

    const paymentDetails = {
      merchantId: 'merchant123',
      amount: 1000
    };

    let paymentResult;
    await act(async () => {
      paymentResult = await result.current.initiatePayment(paymentDetails);
    });

    expect(paymentResult).toEqual(mockResponse);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle payment initiation failure', async () => {
    const error = new Error('Payment failed');
    PaymentService.initiatePayment.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePayment());

    const paymentDetails = {
      merchantId: 'merchant123',
      amount: 1000
    };

    await act(async () => {
      try {
        await result.current.initiatePayment(paymentDetails);
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('should handle invalid amount', async () => {
    const { result } = renderHook(() => usePayment());

    const paymentDetails = {
      merchantId: 'merchant123',
      amount: -100 // Invalid amount
    };

    await act(async () => {
      try {
        await result.current.initiatePayment(paymentDetails);
      } catch (e) {
        expect(e.message).toContain('Invalid amount');
      }
    });
  });
});
