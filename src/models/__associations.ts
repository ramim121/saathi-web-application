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
import ProjectInvestmentBooking from "./ProjectInvestmentBooking";
import DigigramBank from "./DigigramBank";


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

ProjectPartner.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectPartner.belongsTo(User, { foreignKey: 'idUsers' });
ProjectPartner.hasMany(ProjectPartnerInvestor, { foreignKey: 'idProjectPartners' });

ProjectInvestmentBooking.hasMany(ProjectInvestor, { foreignKey: 'idProjectInvestmentBookings' });
ProjectInvestmentBooking.belongsTo(User, { foreignKey: 'idUsers' });
ProjectInvestmentBooking.belongsTo(UserBank, { foreignKey: 'idUserBanks' });

ProjectInvestor.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectInvestor.belongsTo(User, { foreignKey: 'idUsers' });
ProjectInvestor.belongsTo(ProjectInvestmentBooking, { foreignKey: 'idProjectInvestmentBookings' });

ProjectInvestor.hasMany(ProjectPartnerInvestor, { foreignKey: 'idProjectInvestors' });
ProjectPartnerInvestor.belongsTo(ProjectInvestor, { foreignKey: 'idProjectInvestors' });
ProjectPartnerInvestor.belongsTo(ProjectPartner, { foreignKey: 'idProjectPartners' });

UserBank.belongsTo(User, { foreignKey: 'idUsers' });
UserBank.belongsTo(Bank, { foreignKey: 'idBanks' });

File.belongsTo(User, { foreignKey: 'refId' });

export { User, ProjectCategory, Project, ProjectPartner, ProjectInvestor, InvestmentSetup, Skill, File, Blog, ProjectPartnerInvestor, UserBank, Bank, ProjectInvestmentBooking, DigigramBank };
