import { Optional } from 'sequelize';
import ProjectInvestor from './ProjectInvestor';
import ProjectPartner from './ProjectPartner';

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
    dateOfBirth: string;
    emailVerified: 'yes' | 'no';
    phoneVerified: 'yes' | 'no';
    nidNumber: string | null;
    nidImageFront: string | null;
    nidImageBack: string | null;
    profileImage: string | null;
    status: 'active' | 'inactive';
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

}


export interface UserAttributes extends Optional<User, 'idUsers'> { }