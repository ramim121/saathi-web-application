import User from "./User";
import ProjectCategory from "./ProjectCategory";
import Project from "./Project";
import ProjectPartner from "./ProjectPartner";
import ProjectInvestor from "./ProjectInvestor";

User.hasMany(Project, { foreignKey: 'createdBy', as: 'Projects' });
User.hasMany(ProjectPartner, { foreignKey: 'idUsers', as: 'Partnerships' });
User.hasMany(ProjectInvestor, { foreignKey: 'idUsers', as: 'Investments' });

ProjectCategory.hasMany(Project, { foreignKey: 'idProjectCategories', as: 'Projects' });

Project.belongsTo(ProjectCategory, { foreignKey: 'idProjectCategories', as: 'ProjectCategory' });
Project.hasMany(ProjectPartner, { foreignKey: 'idProjects', as: 'ProjectPartners' });
Project.hasMany(ProjectInvestor, { foreignKey: 'idProjects', as: 'ProjectInvestors' });
Project.belongsTo(User, { foreignKey: 'createdBy', as: 'CreatedBy' });

ProjectPartner.belongsTo(Project, { foreignKey: 'idProjects', as: 'Project' });
ProjectPartner.belongsTo(User, { foreignKey: 'idUsers', as: 'User' });

ProjectInvestor.belongsTo(Project, { foreignKey: 'idProjects', as: 'Project' });
ProjectInvestor.belongsTo(User, { foreignKey: 'idUsers', as: 'User' });

export { User, ProjectCategory, Project, ProjectPartner, ProjectInvestor };
