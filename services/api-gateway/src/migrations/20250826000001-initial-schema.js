const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Users table
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true
      },
      phone_number: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
        validate: {
          is: /^254[17][0-9]{8}$/
        }
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      lightning_address: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      wallet_type: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create Merchants table
    await queryInterface.createTable('merchants', {
      id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true
      },
      business_name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      mpesa_shortcode: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      mpesa_phone: {
        type: DataTypes.STRING(15),
        allowNull: true
      },
      contact_email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      location_data: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      verification_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'PENDING',
        validate: {
          isIn: [['PENDING', 'VERIFIED', 'REJECTED']]
        }
      },
      api_key: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create Transactions table
    await queryInterface.createTable('transactions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      merchant_id: {
        type: DataTypes.UUID,
        references: {
          model: 'merchants',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      bitcoin_amount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'Amount in satoshis'
      },
      kes_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
      },
      exchange_rate: {
        type: DataTypes.DECIMAL(15, 8),
        allowNull: false
      },
      lightning_invoice: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      payment_hash: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      mpesa_transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      mpesa_checkout_request_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
        validate: {
          isIn: [['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']]
        }
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    // Create indexes
    await queryInterface.addIndex('transactions', ['user_id', 'status']);
    await queryInterface.addIndex('transactions', ['merchant_id', 'status']);
    await queryInterface.addIndex('transactions', ['created_at']);
    await queryInterface.addIndex('transactions', ['payment_hash'], { unique: true });
    await queryInterface.addIndex('transactions', ['mpesa_transaction_id'], { unique: true });
    await queryInterface.addIndex('merchants', ['mpesa_shortcode'], { unique: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transactions');
    await queryInterface.dropTable('merchants');
    await queryInterface.dropTable('users');
  }
};
