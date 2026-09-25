# Narration CDN

`audio-cdn.yaml` is the CloudFormation stack behind `audioManifest.base`: a
private S3 bucket, a CloudFront distribution that is the only thing allowed to
read it, and an IAM role the `build-audio` workflow assumes through GitHub's
OIDC provider. No access keys are created anywhere.

## Deploy (one time, ~15 minutes)

Deploy in `us-east-1`: CloudFront reads its certificate from there, and keeping
the bucket in the same region keeps the stack to one file.

```sh
# 1. A certificate for the audio hostname (validate through DNS when prompted).
aws acm request-certificate --region us-east-1 \
  --domain-name audio.prayers.dougdevitre.org --validation-method DNS

# 2. The stack. Use the certificate ARN from step 1 once it shows ISSUED.
aws cloudformation deploy --region us-east-1 \
  --stack-name stand-audio \
  --template-file infra/audio-cdn.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    CertificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID \
    DomainName=audio.prayers.dougdevitre.org \
    AppOrigin=https://prayers.dougdevitre.org \
    GitHubRepository=dougdevitre/prayers

# 3. The outputs you need next.
aws cloudformation describe-stacks --region us-east-1 --stack-name stand-audio \
  --query "Stacks[0].Outputs" --output table
```

Then:

- **DNS:** add a CNAME for `audio.prayers.dougdevitre.org` pointing at the
  `DistributionDomainName` output. Until it resolves, the build can use the
  distribution's own hostname as `--base` and the app's CSP will need that
  host instead; the committed CSP names the custom domain.
- **GitHub secrets** (repository settings): `AWS_PUBLISHER_ROLE_ARN` from the
  `PublisherRoleArn` output, `AUDIO_BUCKET` from `BucketName`, and
  `ELEVENLABS_API_KEY`. `AUDIO_BASE_URL` is `https://audio.prayers.dougdevitre.org`.

If the account already has a GitHub OIDC provider, pass its ARN as
`GitHubOidcProviderArn` so the stack does not try to create a second one
(an account can only hold one for that URL).

## What the stack does not do

- Serve anything but GET and HEAD, or anything from the bucket that the app's
  manifest does not name (there is nothing else in it).
- Cache-bust: every object key carries the hash of what it was rendered from,
  so objects are immutable and never invalidated. Old objects are left for a
  lifecycle rule once nothing references them.
- Restrict who can fetch a recording: the URLs are public, like the day pages.
  Signed URLs or a referer rule would be the next step if that ever matters.

## Local publishing

The build script can also upload from a laptop, with a profile whose policy is
the same as the publisher role's (PutObject/GetObject on the bucket's objects,
ListBucket on the bucket):

```sh
npm install --no-save @aws-sdk/client-s3
AWS_PROFILE=stand-audio ELEVENLABS_API_KEY=… \
  node scripts/build-audio.js --only en/day/core --upload \
  --bucket "$(aws cloudformation describe-stacks --stack-name stand-audio --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)" \
  --base https://audio.prayers.dougdevitre.org
```
