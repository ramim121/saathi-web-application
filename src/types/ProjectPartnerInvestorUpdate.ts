import { Optional } from 'sequelize';

export default interface ProjectPartnerInvestorUpdate {
    idProjectPartnerInvestorUpdates: number;
    idProjectpartnerInvestors: number;
    createdAt: Date;
    updatedAt: Date;
    liveWeight?: number | null;
    updateDate: Date;
    updateBody: string;
    updateTitle: string;
    videoUrl?: string;
    updateImage?: string;
    imageThumbnail?: string;
}

export interface ProjectPartnerInvestorUpdateAttributes extends Optional<ProjectPartnerInvestorUpdate, 'idProjectPartnerInvestorUpdates'> { }