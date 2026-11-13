#!/bin/sh
# Manual deploy: upload this folder to S3 and invalidate CloudFront.
# Usage: S3_BUCKET=leo-showcase-site CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC ./scripts/deploy.sh
set -e
cd "$(dirname "$0")/.."
: "${S3_BUCKET:?Set S3_BUCKET, e.g. S3_BUCKET=leo-showcase-site}"
aws s3 sync . "s3://$S3_BUCKET" --delete --exclude ".git/*" --exclude ".github/*"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
fi
echo "Deployed to s3://$S3_BUCKET"
