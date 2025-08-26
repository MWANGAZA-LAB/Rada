-- Insert Sample Data

-- Insert Test Users
INSERT INTO users (username, email, phone_number, password_hash, status)
VALUES 
('john_doe', 'john@example.com', '+254700000001', crypt('Test@123', gen_salt('bf')), 'active'),
('jane_smith', 'jane@example.com', '+254700000002', crypt('Test@123', gen_salt('bf')), 'active'),
('alice_wong', 'alice@example.com', '+254700000003', crypt('Test@123', gen_salt('bf')), 'active');

-- Create Wallets for Users
INSERT INTO wallets (user_id, currency, balance)
SELECT id, 'KES', 10000.00 FROM users WHERE username = 'john_doe'
UNION ALL
SELECT id, 'BTC', 0.05 FROM users WHERE username = 'john_doe'
UNION ALL
SELECT id, 'KES', 15000.00 FROM users WHERE username = 'jane_smith'
UNION ALL
SELECT id, 'BTC', 0.03 FROM users WHERE username = 'jane_smith'
UNION ALL
SELECT id, 'KES', 5000.00 FROM users WHERE username = 'alice_wong';

-- Insert Sample Exchange Rates
INSERT INTO exchange_rates (from_currency, to_currency, rate, source, valid_until)
VALUES
('KES', 'USD', 0.0070, 'forex_api', CURRENT_TIMESTAMP + INTERVAL '1 day'),
('USD', 'KES', 142.85, 'forex_api', CURRENT_TIMESTAMP + INTERVAL '1 day'),
('BTC', 'USD', 45000, 'crypto_api', CURRENT_TIMESTAMP + INTERVAL '1 day'),
('USD', 'BTC', 0.000022, 'crypto_api', CURRENT_TIMESTAMP + INTERVAL '1 day');

-- Insert Sample Transactions
WITH new_transaction AS (
    INSERT INTO transactions (wallet_id, type, amount, currency, status, reference_id)
    SELECT 
        w.id,
        'deposit',
        5000.00,
        'KES',
        'completed',
        'MPE' || gen_random_uuid()
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'john_doe' AND w.currency = 'KES'
    RETURNING id, reference_id
)
INSERT INTO mpesa_transactions (transaction_id, mpesa_receipt_number, phone_number, amount, status)
SELECT 
    id,
    'PXE' || floor(random() * 1000000)::text,
    '+254700000001',
    5000.00,
    'completed'
FROM new_transaction;

-- Insert Bitcoin Transaction
WITH new_btc_transaction AS (
    INSERT INTO transactions (wallet_id, type, amount, currency, status, reference_id)
    SELECT 
        w.id,
        'deposit',
        0.02,
        'BTC',
        'completed',
        'BTC' || gen_random_uuid()
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.username = 'jane_smith' AND w.currency = 'BTC'
    RETURNING id, reference_id
)
INSERT INTO bitcoin_transactions (transaction_id, bitcoin_address, amount_btc, confirmations, tx_hash, status)
SELECT 
    id,
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    0.02,
    6,
    'tx_' || encode(sha256(random()::text::bytea), 'hex'),
    'confirmed'
FROM new_btc_transaction;

-- Insert Sample Audit Logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
SELECT 
    u.id,
    'LOGIN',
    'USER',
    u.id,
    '{"last_login": null}'::jsonb,
    jsonb_build_object('last_login', CURRENT_TIMESTAMP),
    '192.168.1.1'::inet
FROM users u
WHERE username = 'john_doe';
