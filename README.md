# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

v0
edge lambda that can switch sub folder in s3 bucket
bluegreen deploy it

todo for v1
chunked web assets, react lib with lazy loaded pages
sample website to deploy this all to
basic post back metrics for alarms (have webapp have generate metrics for rollback alarm)
client side alarm api gateway
rollback alarm on deployment

idea v2
deploy buckets all around aws regions to be closer to the cloudfront entry point. needs different stacks but consistent deployment id to duplicate assets to all buckets....