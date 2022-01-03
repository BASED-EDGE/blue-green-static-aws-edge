import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'

import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment'
import {Bucket} from 'aws-cdk-lib/aws-s3'
import {CloudFrontWebDistribution, LambdaEdgeEventType, OriginAccessIdentity} from 'aws-cdk-lib/aws-cloudfront'
import {Code, Function, Runtime, Alias} from 'aws-cdk-lib/aws-lambda'
import {LambdaApplication, LambdaDeploymentConfig, LambdaDeploymentGroup} from 'aws-cdk-lib/aws-codedeploy'

interface Props extends StackProps {
  buildId:string
}

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const deploymentId: string = props.buildId

    const bucket = new Bucket(this,'assetBucket',{
      bucketName:'blue-green-static-based-edge',
      removalPolicy:RemovalPolicy.DESTROY
    })
    
    new BucketDeployment(this,'mainPageDeployment',{
      destinationBucket:bucket, 
      sources:[
        Source.asset(__dirname+'/../testSite')
      ]
    })

    // deploy the built js assests in their sub folder
    new BucketDeployment(this,'assetDeployment',{
      destinationBucket:bucket, 
      destinationKeyPrefix:'assets/'+deploymentId, 
      sources:[
        Source.asset(__dirname+'/../client/dist')
      ]
    })

    const edgeLambda = new Function(this,'assetRouter',{
      // todo: set cookie on response so that code knows where to get chunks + know its version? not needed to function
      // todo: use closer s3 bucket?
      // assumes req for /assets/index.js
      code: Code.fromInline(`
      'use strict';

      exports.handler = (event, context, callback) => {
        const request = event.Records[0].cf.request;
        console.log(JSON.stringify(event),request.uri, "${deploymentId}")

        request.uri = '/assets/${deploymentId}/index.js'
        
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

    // todo: immediate rollback for pipeline rollback (reqs pipeline deployment)
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
        {
          behaviors:[
            {
              //cache chunks for ever since they get unique urls per build (ignoring the test page)
              isDefaultBehavior:true,
              defaultTtl:Duration.days(365)
            },
            {
              pathPattern:'/assets/index.js',
              // disable caching so that the blue/green deployments are always being reached
              // this is needed for immediate rollbacks
              maxTtl:Duration.millis(0),
              defaultTtl:Duration.millis(0),
              lambdaFunctionAssociations:[{
                eventType:LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction:edgeLambda.currentVersion
              }],
            },
          ],
          s3OriginSource:{
            s3BucketSource:bucket,
            originAccessIdentity:oai,
          }
        },
        
      ]
    })
/**
 * clientside metric post back to cloudwatch
 * create rollback alarm
 *  */    

  }
}
