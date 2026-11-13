# Deploy to AWS — S3 + CloudFront

One-time setup, about 15 minutes. After that, every `git push` to
`main` deploys automatically (see `.github/workflows/deploy.yml`).

Prerequisites: an AWS account, AWS CLI installed and configured
(`aws configure`, or `aws sso login`), and a bucket name that is
globally unique, e.g. `leo-showcase-site`.

## 1. Create the S3 bucket (private, no public access)

```sh
export S3_BUCKET=leo-showcase-site   # change to your own unique name
export AWS_REGION=us-east-1          # use us-east-1 if you want a custom
                                     # domain with an ACM certificate later

aws s3api create-bucket --bucket "$S3_BUCKET" --region "$AWS_REGION"
aws s3api put-public-access-block --bucket "$S3_BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

The bucket stays private. Nobody reaches S3 directly — CloudFront does,
through Origin Access Control (step 2).

## 2. Create the CloudFront distribution (console, 5 minutes)

1. CloudFront → Create distribution.
2. Origin domain: pick your S3 bucket from the list.
3. Origin access: **Origin access control settings (OAC)** → Create new
   OAC → Create. (CloudFront will show a banner with a bucket policy to
   copy — go to S3 → your bucket → Permissions → Bucket policy, paste it.)
4. Default root object: `index.html`.
5. Viewer protocol policy: **Redirect HTTP to HTTPS**.
6. Price class: Use only North America and Europe (cheapest), or All
   edge locations.
7. Create distribution. Note its **distribution ID** (e.g.
   `E1234567890ABC`) and its domain name (`https://d111111abcdef8.cloudfront.net`).

That CloudFront domain is your live site already — no custom domain is
required to start.

## 3. First upload + check

```sh
# from the showcase-site folder:
S3_BUCKET=leo-showcase-site CLOUDFRONT_DISTRIBUTION_ID=E1234567890ABC ./scripts/deploy.sh
# or manually:
aws s3 sync . "s3://$S3_BUCKET" --delete --exclude ".git/*" --exclude ".github/*"
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
```

Open the CloudFront domain. You should see the intro, the Krun tile,
and "More is coming". Click Krun → the game opens at
`projects/krun/web/game.html`.

## 4. Automatic deploys (GitHub Actions)

1. Push this folder to a GitHub repo.
2. In AWS, create an IAM role for GitHub OIDC (IAM → Identity providers
   → add `token.actions.githubusercontent.com`, then a role trusting it
   with `s3:PutObject/s3:DeleteObject` on your bucket and
   `cloudfront:CreateInvalidation` on your distribution). This avoids
   long-lived access keys.
3. In the GitHub repo → Settings → Secrets and variables → Actions:
   - Secret: `AWS_ROLE_TO_ASSUME` = the role ARN.
   - Variable: `S3_BUCKET` = your bucket name.
   - Variable: `CLOUDFRONT_DISTRIBUTION_ID` = your distribution ID.
4. Push to `main` — the workflow in `.github/workflows/deploy.yml`
   syncs and invalidates.

## 5. Custom domain (optional, later)

1. Route 53 → register or import a domain, e.g. `leohuang.dev`.
2. ACM (in **us-east-1**) → Request a certificate for the domain and
   `*.leohuang.dev`, validate via DNS.
3. CloudFront → your distribution → Settings → Alternate domain names:
   add the domain, attach the ACM certificate.
4. Route 53 → create an A record (alias) pointing the domain to the
   CloudFront distribution.

## Costs (personal traffic)

S3 storage for a site this size is cents. CloudFront has a free tier
(1 TB data transfer out and 10M requests/month in the first year, and a
smaller always-free allowance after that). A personal showcase is
normally **$0–$1/month**. The expensive part to avoid is an always-on
server (ECS/ALB) for a static site — that is why this setup has none.

## Growing beyond static

When a project needs a backend or database, do not touch this setup:

- CloudFront → add a behavior: `/api/*` → API Gateway (→ Lambda) or
  ALB (→ ECS Fargate). Static paths keep going to S3.
- Simple data (leaderboard, contact form, CRUD): Lambda + API Gateway
  + DynamoDB.
- Relational data: Lambda + Aurora Serverless v2 / RDS Postgres, with
  RDS Proxy in front of the database (Lambda concurrency would
  otherwise exhaust database connections).
- Long-running services (WebSocket, GraphQL subscriptions, NestJS):
  ECS Fargate + ALB — that is when ECS earns its keep.

## Amplify shortcut

If you want zero console setup, AWS Amplify Hosting does the same
thing (S3 + CloudFront + certificate) from a git push: Amplify → New
app → Host web app → connect the repo → deploy. Use it if you do not
want to manage the distribution by hand.
