export const API_URL = process.env.API_URL ? process.env.API_URL : 'https://digigramventures.com/';
// export const API_URL = 'http://192.168.91.207:3000/';

export const JWT_SECRET = process.env.JWT_SECRET ? process.env.JWT_SECRET : '778^%009jjnuybbuhuh009*^&^';

export const BULK_SMS_API_KEY = process.env.BULK_SMS_API_KEY ? process.env.BULK_SMS_API_KEY : '4p9RrLDJg0Jm4hx1YfDE'
export const BULK_SMS_SENDER_ID = process.env.BULK_SMS_SENDER_ID ? process.env.BULK_SMS_SENDER_ID : '8809617618599'
export const OTP_EXPIRY = process.env.OTP_EXPIRY ? process.env.OTP_EXPIRY : 5 * 60 * 1000 // 5 minutes

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME ? process.env.S3_BUCKET_NAME : 'saathi-files'
export const S3_BUCKET_REGION = process.env.S3_BUCKET_REGION ? process.env.S3_BUCKET_REGION : 'ap-southeast-1'
export const S3_BUCKET_ACCESS_KEY = process.env.S3_BUCKET_ACCESS_KEY ? process.env.S3_BUCKET_ACCESS_KEY : 'AKIA4MTWJKAASBQ5ENWP'
export const S3_BUCKET_SECRET_KEY = process.env.S3_BUCKET_SECRET_KEY ? process.env.S3_BUCKET_SECRET_KEY : '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'
export const S3_URL = process.env.S3_URL ? process.env.S3_URL : 'https://saathi-files.s3.ap-southeast-1.amazonaws.com/'
