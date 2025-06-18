// export const API_URL = process.env.API_URL ? process.env.API_URL : 'https://api.digigramventures.com/';
export const API_URL = 'http://localhost:3000/';

export const JWT_SECRET = process.env.JWT_SECRET ? process.env.JWT_SECRET : '778^%009jjnuybbuhuh009*^&^';

export const BULK_SMS_API_KEY = process.env.BULK_SMS_API_KEY ? process.env.BULK_SMS_API_KEY : '4p9RrLDJg0Jm4hx1YfDE';
export const BULK_SMS_SENDER_ID = process.env.BULK_SMS_SENDER_ID ? process.env.BULK_SMS_SENDER_ID : '8809617618599';
export const OTP_EXPIRY = process.env.OTP_EXPIRY ? process.env.OTP_EXPIRY : 1 * 60 * 1000 // 5 minutes

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ? process.env.S3_BUCKET_NAME : 'saathi-files';
export const S3_BUCKET_REGION = process.env.S3_BUCKET_REGION ? process.env.S3_BUCKET_REGION : 'ap-southeast-1';
export const S3_BUCKET_ACCESS_KEY = process.env.S3_BUCKET_ACCESS_KEY ? process.env.S3_BUCKET_ACCESS_KEY : 'AKIA4MTWJKAASBQ5ENWP';
export const S3_BUCKET_SECRET_KEY = process.env.S3_BUCKET_SECRET_KEY ? process.env.S3_BUCKET_SECRET_KEY : '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';
export const S3_URL = process.env.S3_URL ? process.env.S3_URL : 'https://saathi-files.s3.ap-southeast-1.amazonaws.com/';

export const DB_NAME = process.env.DB_NAME ? process.env.DB_NAME : 'saathi_db';
export const DB_USER = process.env.DB_USER ? process.env.DB_USER : 'saathi_admin';
export const DB_PASSWORD = process.env.DB_PASSWORD ? process.env.DB_PASSWORD : 'w607kTcCngWiq8U';
export const DB_HOST = process.env.DB_HOST ? process.env.DB_HOST : 'saathi-db.cla6si4uaanu.ap-southeast-1.rds.amazonaws.com';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID : '1055024852778-23tb7da8pka2vnatqiej8emuv2t01qem.apps.googleusercontent.com';

export const SES_AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID : 'AKIA4MTWJKAAYBQFWJ3L';
export const SES_AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY ? process.env.AWS_SECRET_ACCESS_KEY : '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';
export const SES_AWS_REGION = process.env.AWS_REGION ? process.env.AWS_REGION : 'ap-northeast-1';

export const APPLE_CLIENT_ID      = "com.digigram.saathi";      // e.g. com.yourcompany.app.signin
export const APPLE_TEAM_ID        = "Q2AU97NY2Z";        // your 10-char Team ID
export const APPLE_KEY_ID         = "576Y8AWU3L";         // the key’s ID from Apple
export const APPLE_PRIVATE_KEY    = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgvPTOPaLE88ze8K4H
O1CSIneRoDs3xLhy5eGhixz0SAWgCgYIKoZIzj0DAQehRANCAARYWboLUDBgJN5F
xBui4TxOao+f/NpVLj/Fj8xzNeZEwgwfdq3TTE4uenWujlV7vlhk/+vL50/MgdWQ
LOZYS7d6
-----END PRIVATE KEY-----`; // your private key in PEM format
