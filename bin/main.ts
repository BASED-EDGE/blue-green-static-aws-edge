#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/main-stack';
import * as fs from 'fs'
import { EdgeBucket } from '../lib/edge-bucket';
const buildId = fs.readFileSync(__dirname+'/../client/dist/build_id').toString()

// provide your own values here
const domain = 'blue-green-edge.aws.basededge.dev' 
const hostedZoneId = 'Z0630705FUHFQKZXUICG'
const originAccessIdentityName = 'E2VN1ZM7T7QW4W'
const regions = [
  // all other NA regions as of jan 2022
  'us-west-1',
  'us-west-2',
  'us-east-2',
  'ca-central-1',
  // put other aws regions close to your users here.
]

const app = new cdk.App()
new MainStack(app, 'MainStack', {
  env:{
    region:'us-east-1' // must be in us-east-1 for creating the edge lambdas
  },
  buildId,
  domain, 
  regions,
  hostedZoneId
});


regions.map(region => {
  new EdgeBucket(app,`${region}-EdgeBucket`,{
    env:{
      region
    },
    domain,
    originAccessIdentityName
  })
})