import { registerAs } from '@nestjs/config';

export default registerAs('appConfig', () => ({
  enviroment: process.env.NODE_ENV || 'production',
  arvanBucketName: process.env.ARVAN_BUCKET_NAME,
  arvanRegion: process.env.ARVAN_REGION,
  arvanEndpoint: process.env.ARVAN_ENDPOINT,
  arvanAccessKey: process.env.ARVAN_ACCESS_KEY,
  arvanSecretKey: process.env.ARVAN_SECRET_KEY,
}));
