import User from "./User";
import ProjectCategory from "./ProjectCategory";
import Project from "./Project";
import ProjectPartner from "./ProjectPartner";
import ProjectInvestor from "./ProjectInvestor";
import InvestmentSetup from "./InvestmentSetup";
import Skill from "./Skill";
import File from "./File";

User.hasMany(Project, { foreignKey: 'createdBy', as: 'Projects' });
User.hasMany(ProjectPartner, { foreignKey: 'idUsers', as: 'Partnerships' });
User.hasMany(ProjectInvestor, { foreignKey: 'idUsers', as: 'Investments' });

ProjectCategory.hasMany(Project, { foreignKey: 'idProjectCategories', as: 'Projects' });

Project.belongsTo(ProjectCategory, { foreignKey: 'idProjectCategories', as: 'ProjectCategory' });
Project.hasMany(ProjectPartner, { foreignKey: 'idProjects', as: 'ProjectPartners' });
Project.hasMany(ProjectInvestor, { foreignKey: 'idProjects', as: 'ProjectInvestors' });
Project.belongsTo(User, { foreignKey: 'createdBy', as: 'CreatedBy' });

ProjectPartner.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectPartner.belongsTo(User, { foreignKey: 'idUsers' });

ProjectInvestor.belongsTo(Project, { foreignKey: 'idProjects' });
ProjectInvestor.belongsTo(User, { foreignKey: 'idUsers' });

export { User, ProjectCategory, Project, ProjectPartner, ProjectInvestor, InvestmentSetup, Skill, File };
