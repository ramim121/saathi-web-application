import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectSpecialBookingReqAttributes } from '@/types/ProjectSpecialBookingReq';

interface ProjectSpecialBookingReqModel extends ProjectSpecialBookingReqAttributes, Model { }

const ProjectSpecialBookingReq = sequelize.define<ProjectSpecialBookingReqModel>('ProjectSpecialBookingReq', {
    idProjectSpecialBookingReqs: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    deliveryLocation: {
        type: DataTypes.STRING,
        allowNull: true
    },
    preferredColor: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    preferredProductPrice: {
        type: DataTypes.DECIMAL(10, 0),
        allowNull: true
    },
    additionalRequest: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'project_special_booking_reqs',
    underscored: true,
    timestamps: true
});

export default ProjectSpecialBookingReq;