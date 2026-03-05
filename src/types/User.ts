import { Optional } from 'sequelize';
import ProjectInvestor from './ProjectInvestor';
import ProjectPartner from './ProjectPartner';
import UserBank from './UserBank';
import File from './File';

type UserType = 'admin' | 'investor' | 'partner';


export default interface User {
    idUsers: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    createdAt: Date;
    updatedAt: Date;
    userType: UserType;
    dateOfBirth: Date;
    emailVerified: 'yes' | 'no';
    phoneVerified: 'yes' | 'no';
    nidNumber: string | null;
    nidImageFront: string | null;
    nidImageBack: string | null;
    nidVerified: 'yes' | 'no';
    nidVerificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
    profileImage: string | null;
    status: 'active' | 'inactive' | 'deleted';
    age: number | null;
    location: string | null;
    role: string | null;
    bio: string | null;
    interestedIn: string | null;
    skills: string | null;
    joiningDate: Date | null;
    education: string | null;
    Investments?: ProjectInvestor[];
    Partnerships?: ProjectPartner[];
    disability: 'yes' | 'no';
    partnerType: 'none' | 'project' | 'product' | 'both';
    googleId: string | null;
    googleLogin: 'yes' | 'no';
    appleId: string | null;
    appleLogin: 'yes' | 'no';
    UserBanks?: UserBank[];
    ProfilePicture?: File;
    FeaturedImages?: File[];
}


export interface UserAttributes extends Optional<User, 'idUsers'> { }