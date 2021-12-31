import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment'
import {Bucket} from 'aws-cdk-lib/aws-s3'
import {CloudFrontWebDistribution, LambdaEdgeEventType, OriginAccessIdentity} from 'aws-cdk-lib/aws-cloudfront'
import {Code, Function, Runtime, Alias} from 'aws-cdk-lib/aws-lambda'
import {LambdaApplication, LambdaDeploymentConfig, LambdaDeploymentGroup} from 'aws-cdk-lib/aws-codedeploy'
export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const deploymentId: string = ''+new Date().valueOf()

    const bucket = new Bucket(this,'assetBucket',{
      bucketName:'blue-green-static-based-edge',
      removalPolicy:RemovalPolicy.DESTROY
    })
    

    new BucketDeployment(this,'assetDeployment',{destinationBucket:bucket, 
      destinationKeyPrefix:deploymentId, 
      sources:[
        Source.asset(__dirname+'/../assets')
      ]
    })

    const edgeLambda = new Function(this,'assetRouter',{
      // todo: set cookie on response so that code knows where to get chunks + know its version?
      // todo: use closer s3 bucket?
      code: Code.fromInline(`
      'use strict';

      exports.handler = (event, context, callback) => {
        const request = event.Records[0].cf.request;
        console.log(JSON.stringify(event),request.uri, "${deploymentId}")

        request.uri = '/${deploymentId}'+request.uri
        
        callback(null, request);
      }
      `),
      handler:'index.handler',
      runtime:Runtime.NODEJS_14_X,
      description:'edge lambda for pciking s3 deployment to serve. '+deploymentId // always update lambda fn config so that it will trigger deployment
    })

    const alias = new Alias(this,'assetRouterAlias',{
      version:edgeLambda.currentVersion,
      aliasName:'edgeLambda'
    })
    const la = new LambdaApplication(this,'edgeLambdaDeploy',{
      applicationName:'assetRouter',
    })

    new LambdaDeploymentGroup(this,'ldp',{
      application:la,
      alias:alias,
      deploymentConfig:LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
      autoRollback:{
        failedDeployment:true,
        deploymentInAlarm:false, //todo alarms....
      }
    })

    
    const oai = new OriginAccessIdentity(this,'oai',{
    })

    bucket.grantRead(oai)
    new CloudFrontWebDistribution(this,'dist',{
      originConfigs:[
        // entry point index.js
        {
          behaviors:[
            {
              //cache chunks for ever since they get unique 
              isDefaultBehavior:true,
              defaultTtl:Duration.days(365)
            },
            {
              pathPattern:'index.js',
              maxTtl:Duration.millis(0),
              defaultTtl:Duration.millis(0),
              lambdaFunctionAssociations:[{
                eventType:LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction:edgeLambda.currentVersion
              }],
            }
          ],
          s3OriginSource:{
            s3BucketSource:bucket,
            originAccessIdentity:oai,
          }
        },
        
        // todo: add chunked support with 1yr ttl
      ]
    })
/**
 * creat unique deployment id
 * s3 website deploy into that folder
 * cloudfront dist
 * edge lambda that points request to s3 bucket
 * blue/green deploy the edge lambda
 * clientside metric post back to cloudwatch
 * create rollback alarm
 *  */    

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'AssQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
