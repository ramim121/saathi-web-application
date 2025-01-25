// db-sync.js
import { Sequelize } from 'sequelize';
import {
    User,
    ProjectCategory,
    Project,
    ProjectPartner,
    ProjectInvestor,
    InvestmentSetup,
    Skill,
    File,
    Blog,
    ProjectPartnerInvestor,
    UserBank,
    Bank,
    BankBranch,
    ProjectInvestmentBooking,
    DigigramBank,
    Product,
    ProductCategory,
    ProductImage,
    ProductStock,
    ProductPacking,
    AppStatPanel,
    ManualNotification,
    ProjectInvestmentBookingStatus,
    ProjectProperty,
    ProjectInvestorStatus,
    ProjectPartnerInvestorUpdate,
    AppFcmToken,
    AppVersion,
    ContactMessage,
    NotificationQueue,
    NotificationTemplate,
    ProductPartner,
    ProjectSpecialBookingReq
} from './__associations';

import { DB_NAME, DB_HOST, DB_PASSWORD, DB_USER } from '@/config/constants';

// 1. Create a new Sequelize instance
const sequelize = new Sequelize(
    DB_NAME,       // database name
    DB_USER,   // username
    DB_PASSWORD,   // password
    {
        host: DB_HOST,
        dialect: 'mysql',         // or 'postgres' | 'sqlite' | 'mssql'
        logging: console.log,     // or false if you don't want SQL logs
        // other Sequelize config goes here
    }
);

export async function syncDatabase() {
    try {
        // 2. (Optional) If you need to call init on each model, do so here.
        //    This depends on how you've set up your individual model files.
        //
        // Example if you have to manually init each model:
        // 
        // User.init(userSchema, { sequelize, modelName: 'User' });
        // Project.init(projectSchema, { sequelize, modelName: 'Project' });
        // ... and so on
        //
        // If your model files are already doing Model.init internally,
        // you can skip manual init calls here.

        // 3. Run associations (they are already run in ./associations.js by virtue of the import).
        //    Make sure your associations.js runs *after* you’ve defined Model.init() for each model.
        //    If everything is in the correct order, you’re good to go.

        // 4. Sync the database (this actually creates/updates the tables)
        //    WARNING: force: true will drop tables first. Use with caution.
        await User.sync({ force: true });
        await Bank.sync({ force: true });
        await BankBranch.sync({ force: true });
        await ProjectCategory.sync({ force: true });
        await Project.sync({ force: true });
        await ProjectPartner.sync({ force: true });
        await InvestmentSetup.sync({ force: true });
        await Skill.sync({ force: true });
        await File.sync({ force: true });
        await Blog.sync({ force: true });
        await UserBank.sync({ force: true });
        await ProjectInvestmentBooking.sync({ force: true });
        await ProjectInvestor.sync({ force: true });
        await ProjectPartnerInvestor.sync({ force: true });
        await DigigramBank.sync({ force: true });
        await Product.sync({ force: true });
        await ProductCategory.sync({ force: true });
        await ProductImage.sync({ force: true });
        await ProductStock.sync({ force: true });
        await ProductPacking.sync({ force: true });
        await AppStatPanel.sync({ force: true });
        await ManualNotification.sync({ force: true });
        await ProjectInvestmentBookingStatus.sync({ force: true });
        await ProjectProperty.sync({ force: true });
        await ProjectInvestorStatus.sync({ force: true });
        await ProjectPartnerInvestorUpdate.sync({ force: true });
        await AppFcmToken.sync({ force: true });
        await AppVersion.sync({ force: true });
        await ContactMessage.sync({ force: true });
        await NotificationQueue.sync({ force: true });
        await NotificationTemplate.sync({ force: true });
        await ProductPartner.sync({ force: true });
        await ProjectSpecialBookingReq.sync({ force: true });

        console.log('Database synced successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing the database:', error);
        process.exit(1);
    }
}

