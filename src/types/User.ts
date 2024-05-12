type UserType = 'admin' | 'investor' | 'partner';


export default interface User {
    idUsers: number;
    fullName: string | null;
    email: string | null;
    phoneNumber: string | null;
    password: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    userType: UserType;
    emailVerified: 'yes' | 'no';
    phoneVerified: 'yes' | 'no';
    nidNumber: string | null;
    nidImageFront: string | null;
    nidImageBack: string | null;
    profileImage: string | null;
    status: 'active' | 'inactive';
}
