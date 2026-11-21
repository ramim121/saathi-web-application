import { Model, DataTypes, type Optional } from 'sequelize';
import sequelize from '../config/db';

/**
 * Money held for an investor between investments (db/migrations/014).
 *
 * A ledger: one signed row per movement. + is owed to the investor (profit to
 * pay out, the part of a reinvestment that did not make a whole unit), - is
 * money that left the balance (paid out, used toward a booking). The balance
 * is the sum. Rows are never edited; `reversal` rows undo earlier ones.
 */
export type BalanceEntryType = 'profit_payable' | 'reinvest_remainder' | 'applied_to_booking' | 'paid_out' | 'reversal' | 'adjustment';

export interface InvestorBalanceEntryAttributes {
    idInvestorBalanceEntries: number;
    idUsers: number;
    amount: string | number;
    entryType: BalanceEntryType;
    idProjectInvestors: number | null;
    idProjectInvestmentBookings: number | null;
    reversesId: number | null;
    note: string | null;
    createdBy: number | null;
    createdAt?: Date;
    updatedAt?: Date;
}

type CreationAttributes = Optional<
    InvestorBalanceEntryAttributes,
    'idInvestorBalanceEntries' | 'idProjectInvestors' | 'idProjectInvestmentBookings' | 'reversesId' | 'note' | 'createdBy'
>;

export interface InvestorBalanceEntryModel extends Model<InvestorBalanceEntryAttributes, CreationAttributes>, InvestorBalanceEntryAttributes {}

const InvestorBalanceEntry = sequelize.define<InvestorBalanceEntryModel>('InvestorBalanceEntry', {
    idInvestorBalanceEntries: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
    },
    entryType: {
        type: DataTypes.ENUM('profit_payable', 'reinvest_remainder', 'applied_to_booking', 'paid_out', 'reversal', 'adjustment'),
        allowNull: false,
    },
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    idProjectInvestmentBookings: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    reversesId: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    note: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    tableName: 'investor_balance_entries',
    underscored: true,
    timestamps: true,
});

export default InvestorBalanceEntry;
