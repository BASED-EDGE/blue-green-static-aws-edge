#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MainStack } from '../lib/main-stack';
import * as fs from 'fs'
const buildId = fs.readFileSync(__dirname+'/../client/dist/build_id').toString()

const app = new cdk.App();
new MainStack(app, 'MainStack', {
  env:{
    region:'us-east-1' // must be in us-east-1 for creating the edge lambdas
  },
  buildId
});