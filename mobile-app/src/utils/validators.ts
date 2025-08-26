/**
 * Validate Kenyan phone number format
 * @param phoneNumber Phone number to validate
 * @returns boolean
 */
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const kenyaPhoneRegex = /^(?:254|\+254|0)?([17](0|1|2|4|5|6|7|8|9)[0-9]{6})$/;
  return kenyaPhoneRegex.test(phoneNumber);
};

/**
 * Validate M-PESA amount
 * @param amount Amount to validate
 * @returns boolean
 */
export const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 150000; // M-PESA transaction limit
};

/**
 * Validate Bitcoin address
 * @param address Bitcoin address to validate
 * @returns boolean
 */
export const validateBitcoinAddress = (address: string): boolean => {
  const btcAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
  return btcAddressRegex.test(address);
};

/**
 * Validate Lightning invoice
 * @param invoice Lightning invoice to validate
 * @returns boolean
 */
export const validateLightningInvoice = (invoice: string): boolean => {
  return invoice.toLowerCase().startsWith('lnbc');
};

/**
 * Format amount to KES with comma separators
 * @param amount Amount to format
 * @returns Formatted string
 */
export const formatKESAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount);
};

/**
 * Format Bitcoin amount to sats
 * @param amount Amount in satoshis
 * @returns Formatted string
 */
export const formatSatsAmount = (amount: number): string => {
  return `${amount.toLocaleString()} sats`;
};

/**
 * Format date to locale string
 * @param date Date to format
 * @returns Formatted string
 */
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
