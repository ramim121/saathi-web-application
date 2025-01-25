import User from "./User";
import ProjectCategory from "./ProjectCategory";
import Project from "./Project";
import ProjectPartner from "./ProjectPartner";
import ProjectInvestor from "./ProjectInvestor";
import InvestmentSetup from "./InvestmentSetup";
import Skill from "./Skill";
import File from "./File";
import Blog from "./Blog";
import ProjectPartnerInvestor from "./ProjectPartnerInvestor";
import UserBank from "./UserBank";
import Bank from "./Bank";
import BankBranch from "./BankBranch";
import ProjectInvestmentBooking from "./ProjectInvestmentBooking";
import DigigramBank from "./DigigramBank";
import Product from "./Product";
import ProductCategory from "./ProductCategory";
import ProductImage from "./ProductImage";
import ProductStock from "./ProductStock";
import ProductPacking from "./ProductPacking";
import AppStatPanel from "./AppStatPanel";
import ManualNotification from "./ManualNotification";
import ProjectInvestmentBookingStatus from "./ProjectInvestmentBookingStatus";
import ProjectProperty from "./ProjectProperty";
import ProjectInvestorStatus from "./ProjectInvestorStatus";
import ProjectSpecialBookingReq from "./ProjectSpecialBookingReq";

User.hasMany(Project, { foreignKey: 'createdBy', as: 'Projects' });
User.hasMany(ProjectPartner, { foreignKey: 'idUsers', as: 'Partnerships' });
User.hasMany(ProjectInvestor, { foreignKey: 'idUsers', as: 'Investments' });
User.hasMany(ProjectInvestmentBooking, { foreignKey: 'idUsers' });
User.hasMany(UserBank, { foreignKey: 'idUsers' });

User.hasOne(File, {
	foreignKey: 'refId', as: 'ProfilePicture', scope: {
		ref_type: 'profile-picture'
	}
});
User.hasMany(File, {
	foreignKey: 'refId', as: 'FeaturedImages', scope: {
		ref_type: 'featured-image'
	}
})
ProjectCategory.hasMany(Project, { foreignKey: 'idProjectCategories', as: 'Projects' });

Project.belongsTo(ProjectCategory, { foreignKey: 'idProjectCategories', as: 'ProjectCategory' });
Project.hasMany(ProjectPartner, { foreignKey: 'idProjects', as: 'ProjectPartners' });
Project.hasMany(ProjectInvestor, { foreignKey: 'idProjects', as: 'ProjectInvestors' });
Project.belongsTo(User, { foreignKey: 'createdBy', as: 'CreatedBy' });
Project.hasOne(File, {
	foreignKey: 'refId', as: 'MainImage', scope: {
		ref_type: 'project-main-image'
	}
});
Project.hasMany(File, {
	foreignKey: 'refId', as: 'FeaturedImages', scope: {
		ref_type: 'project-featured-image'
	}
})
Project.hasOne(ProjectProperty, { foreignKey: 'idProjects' });

ProjectPartner.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectPartner.belongsTo(User, { foreignKey: 'idUsers' });
ProjectPartner.hasMany(ProjectPartnerInvestor, { foreignKey: 'idProjectPartners' });

ProjectInvestmentBooking.hasMany(ProjectInvestor, { foreignKey: 'idProjectInvestmentBookings' });
ProjectInvestmentBooking.belongsTo(User, { foreignKey: 'idUsers' });
ProjectInvestmentBooking.belongsTo(UserBank, { foreignKey: 'idUserBanks' });
ProjectInvestmentBooking.hasMany(ProjectInvestmentBookingStatus, { foreignKey: 'idProjectInvestmentBookings' });

ProjectInvestmentBookingStatus.belongsTo(ProjectInvestmentBooking, { foreignKey: 'idProjectInvestmentBookings' });
ProjectInvestmentBookingStatus.belongsTo(User, { foreignKey: 'idUsers' });


ProjectInvestor.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectInvestor.belongsTo(User, { foreignKey: 'idUsers' });
ProjectInvestor.belongsTo(ProjectInvestmentBooking, { foreignKey: 'idProjectInvestmentBookings' });

ProjectInvestor.hasMany(ProjectPartnerInvestor, { foreignKey: 'idProjectInvestors' });
ProjectInvestor.hasMany(ProjectInvestorStatus, { foreignKey: 'idProjectInvestors' });
ProjectInvestor.belongsTo(ProjectSpecialBookingReq, { foreignKey: 'idProjectInvestors' });

ProjectInvestorStatus.belongsTo(ProjectInvestor, { foreignKey: 'idProjectInvestors' });
ProjectInvestorStatus.belongsTo(User, { foreignKey: 'idUsers' });


ProjectPartnerInvestor.belongsTo(ProjectInvestor, { foreignKey: 'idProjectInvestors' });
ProjectPartnerInvestor.belongsTo(ProjectPartner, { foreignKey: 'idProjectPartners' });

UserBank.belongsTo(User, { foreignKey: 'idUsers' });
UserBank.belongsTo(Bank, { foreignKey: 'idBanks' });
UserBank.belongsTo(BankBranch, { foreignKey: 'idBankBranches' });

File.belongsTo(User, { foreignKey: 'refId' });

ManualNotification.belongsTo(User, { foreignKey: 'createdBy' });

Bank.hasMany(BankBranch, { foreignKey: 'idBanks' });

ProjectProperty.belongsTo(Project, { foreignKey: 'idProjects' });

export { User, ProjectCategory, Project, ProjectPartner, ProjectInvestor, InvestmentSetup, Skill, File, Blog, ProjectPartnerInvestor, UserBank, Bank, BankBranch, ProjectInvestmentBooking, DigigramBank, Product, ProductCategory, ProductImage, ProductStock, ProductPacking, AppStatPanel, ManualNotification, ProjectInvestmentBookingStatus, ProjectInvestorStatus, ProjectProperty, ProjectSpecialBookingReq };
