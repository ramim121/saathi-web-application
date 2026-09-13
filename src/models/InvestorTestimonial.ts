import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { InvestorTestimonialAttributes } from '@/types/InvestorTestimonial';

interface InvestorTestimonialModel extends InvestorTestimonialAttributes, Model { }

const InvestorTestimonial = sequelize.define<InvestorTestimonialModel>('InvestorTestimonial', {
    idInvestorTestimonials: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    testimonial: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // Bangla counterparts — migration 002_bangla_columns.sql.
    nameBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    testimonialBn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'investor_testimonials',
    underscored: true,
    timestamps: true,
});

export default InvestorTestimonial;