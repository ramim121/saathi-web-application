export default interface JWTPayload {
    idUsers: number;
    userType: 'admin' | 'partner' | 'investor';
}