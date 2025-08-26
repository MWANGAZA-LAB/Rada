-- Useful Queries for Rada Database

-- 1. Get User Balance for All Currencies
SELECT 
    u.username,
    u.email,
    w.currency,
    w.balance
FROM users u
JOIN wallets w ON u.id = w.user_id
ORDER BY u.username, w.currency;

-- 2. Get Recent Transactions for a User
SELECT 
    t.created_at,
    t.type,
    t.amount,
    t.currency,
    t.status,
    t.reference_id
FROM transactions t
JOIN wallets w ON t.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE u.username = 'john_doe'
ORDER BY t.created_at DESC
LIMIT 10;

-- 3. Get M-PESA Transaction Details
SELECT 
    m.mpesa_receipt_number,
    m.phone_number,
    m.amount,
    m.status,
    m.result_desc,
    t.created_at
FROM mpesa_transactions m
JOIN transactions t ON m.transaction_id = t.id
ORDER BY t.created_at DESC;

-- 4. Get Bitcoin Transaction Details
SELECT 
    b.bitcoin_address,
    b.amount_btc,
    b.confirmations,
    b.tx_hash,
    b.status,
    t.created_at
FROM bitcoin_transactions b
JOIN transactions t ON b.transaction_id = t.id
ORDER BY t.created_at DESC;

-- 5. Get Current Exchange Rates
SELECT 
    from_currency,
    to_currency,
    rate,
    source,
    valid_until
FROM exchange_rates
WHERE valid_until > CURRENT_TIMESTAMP
ORDER BY from_currency, to_currency;

-- 6. Get User Activity Audit Log
SELECT 
    a.created_at,
    u.username,
    a.action,
    a.entity_type,
    a.old_values,
    a.new_values,
    a.ip_address
FROM audit_logs a
JOIN users u ON a.user_id = u.id
ORDER BY a.created_at DESC;

-- 7. Get Wallet Transaction Summary
SELECT 
    w.currency,
    COUNT(t.id) as transaction_count,
    SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END) as total_deposits,
    SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount ELSE 0 END) as total_withdrawals
FROM wallets w
LEFT JOIN transactions t ON w.id = t.wallet_id
GROUP BY w.currency;

-- 8. Find Failed Transactions
SELECT 
    t.id,
    t.type,
    t.amount,
    t.currency,
    t.reference_id,
    t.created_at,
    COALESCE(m.result_desc, b.status) as failure_reason
FROM transactions t
LEFT JOIN mpesa_transactions m ON t.id = m.transaction_id
LEFT JOIN bitcoin_transactions b ON t.id = b.transaction_id
WHERE t.status = 'failed'
ORDER BY t.created_at DESC;

-- 9. Get User Registration Trends
SELECT 
    DATE_TRUNC('day', created_at) as registration_date,
    COUNT(*) as new_users
FROM users
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY registration_date DESC;

-- 10. Calculate Average Transaction Amount by Currency
SELECT 
    currency,
    type,
    COUNT(*) as transaction_count,
    AVG(amount) as average_amount
FROM transactions
WHERE status = 'completed'
GROUP BY currency, type
ORDER BY currency, type;

-- 11. Find Dormant Wallets
SELECT 
    u.username,
    w.currency,
    w.balance,
    w.updated_at as last_activity
FROM wallets w
JOIN users u ON w.user_id = u.id
WHERE w.updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY w.updated_at;
