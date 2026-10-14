const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./index');

let s3Client;

if (config.aws.accessKeyId && config.aws.secretAccessKey) {
  s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
} else {
  // Fallback or mock setup could be here if needed
  s3Client = new S3Client({ region: config.aws.region || 'ap-south-1' });
}

module.exports = s3Client;
