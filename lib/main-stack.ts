import { Duration, RemovalPolicy, Stack, StackProps,CfnOutput } from 'aws-cdk-lib'
import { Construct, } from 'constructs'

import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment'
import {Bucket} from 'aws-cdk-lib/aws-s3'
import {CloudFrontWebDistribution, LambdaEdgeEventType, OriginAccessIdentity} from 'aws-cdk-lib/aws-cloudfront'
import {Code, Function, Runtime, Alias} from 'aws-cdk-lib/aws-lambda'
import {LambdaApplication, LambdaDeploymentConfig, LambdaDeploymentGroup} from 'aws-cdk-lib/aws-codedeploy'
import {CfnRecordSet} from 'aws-cdk-lib/aws-route53'
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam'
import {Alarm, ComparisonOperator, Metric, TreatMissingData} from 'aws-cdk-lib/aws-cloudwatch'

import {HttpApi, HttpMethod} from '@aws-cdk/aws-apigatewayv2-alpha'
import {HttpLambdaIntegration} from '@aws-cdk/aws-apigatewayv2-integrations-alpha'

interface Props extends StackProps {
  buildId:string
  domain?:string
  regions?:string[]
  hostedZoneId?:string
}

const NAMESPACE =  'BlueGreenStaticAWSEdge'

export class MainStack extends Stack {
  public originAccessIdName:string

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const deploymentId: string = props.buildId

    const bucket = new Bucket(this,'assetBucket',{
      bucketName: props.domain ? 
      `${props.env?.region}-bucket.${props.domain}` :
      `${props.env?.account}-${props.env?.region}-blue-green-static-edge`, // fallback in case one does not want to use/have a custom domain
      removalPolicy:RemovalPolicy.DESTROY, // easier for clean up
    })

    // put some basic static assets at the root to host the js assets
    new BucketDeployment(this,'mainPageDeployment',{
      destinationBucket:bucket, 
      sources:[
        Source.asset(__dirname+'/../testSite')
      ]
    })
 
    // deploy the built js assets in their sub folder
    new BucketDeployment(this,'assetDeployment',{
      destinationBucket:bucket, 
      destinationKeyPrefix:'assets/'+deploymentId, 
      sources:[
        Source.asset(__dirname+'/../client/dist')
      ]
    })

    //copy assets over to the 'edge buckets'
    // taking advantage of s3's globalish nature...
    // cant have s3 do it for us in the background since you can only replicate to 1 bucket
    props.regions?.forEach(region => {
      const destinationBucket = Bucket.fromBucketName(this,'dupBucket_'+region,`${region}-bucket.${props.domain}`)
      new BucketDeployment(this,'mainPageDeployment'+region,{
        destinationBucket, 
        sources:[
          Source.asset(__dirname+'/../testSite')
        ]
      })

      new BucketDeployment(this,'assetDeployment'+region,{
        destinationBucket, 
        destinationKeyPrefix:'assets/'+deploymentId, 
        sources:[
          Source.asset(__dirname+'/../client/dist')
        ]
      })
    })


    const clientSideAlarm = new Alarm(this,'clientSideAlarm',{
      // adjust these values to suit your needs. these value are for testing
      evaluationPeriods:1,
      threshold:2,
      metric:new Metric({
        metricName:'clientSideError',
        namespace:NAMESPACE,
        statistic:'sum',
        period: Duration.minutes(5)
      }),
      comparisonOperator:ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmName:'clientSideAlarm',
      treatMissingData:TreatMissingData.NOT_BREACHING 
    })

    const edgeLambda = new Function(this,'assetRouter',{
      // todo: set cookie on response so that code knows where to get chunks + know its version? not needed to function
      // uses closer s3 bucket? - use dns to look up TXT for closes region, change bucket to ${region}-bucket.${props.domain}. for WA , saves ~40-100ms reading from the us-west-2 bucket instead of us-east-1
      // assumes req for /assets/index.js
      // influenced by https://aws.amazon.com/blogs/apn/using-amazon-cloudfront-with-multi-region-amazon-s3-origins/
      code: Code.fromInline(`
      'use strict';
      const dns = require('dns').promises
      let cachedRegion = null

      exports.handler = async (event, context, callback) => {
        const request = event.Records[0].cf.request;
        //console.log(JSON.stringify(event),request.uri, "${deploymentId}")
        
        try {
          if (!cachedRegion){
            const result = await dns.resolveTxt('bucket.${props.domain}')
            cachedRegion = result[0][0]
          }

          const region = cachedRegion
          request.origin.s3.domainName = region+'-bucket.${props.domain}.s3.'+region+'.amazonaws.com'
          request.origin.s3.region = region
          request.headers['host'] = [{ key: 'host', value: region+'-bucket.${props.domain}.s3.'+region+'.amazonaws.com' }]
        } catch (e){
          // suppress error
          console.error(e) 
        }

        request.uri = '/assets/${deploymentId}/index.js'
        
        //console.log(JSON.stringify(request))
        
        callback(null, request);
      }
      `),
      handler:'index.handler',
      runtime:Runtime.NODEJS_14_X,
      description:'edge lambda for picking s3 deployment to serve. '+deploymentId // always update lambda fn config so that it will trigger deployment
    })

    const chunkEdgeLambda = new Function(this,'chunkEdgeLambda',{
      code: Code.fromInline(`
      'use strict';
      const dns = require('dns').promises
      let cachedRegion = null

      exports.handler = async (event, context, callback) => {
        const request = event.Records[0].cf.request;

        try {
          if (!cachedRegion) {
            const result = await dns.resolveTxt('bucket.${props.domain}')
            cachedRegion = result[0][0]
          }
          const region = cachedRegion   
          request.origin.s3.domainName = region+'-bucket.${props.domain}.s3.'+region+'.amazonaws.com'
          request.origin.s3.region = region
          request.headers['host'] = [{ key: 'host', value: region+'-bucket.${props.domain}.s3.'+region+'.amazonaws.com' }]
        } catch (e){
          // suppress error
          console.error(e) 
        }
        callback(null, request);
      }
      `),
      handler:'index.handler',
      runtime:Runtime.NODEJS_14_X,
      description:'edge lambda for serving asset chunks. ' // always update lambda fn config so that it will trigger deployment
    })

    const alias = new Alias(this,'assetRouterAlias',{
      version:edgeLambda.currentVersion,
      aliasName:'edgeLambda'
    })
    const la = new LambdaApplication(this,'edgeLambdaDeploy',{
      applicationName:'assetRouter',
    })

    // todo: immediate rollback for pipeline rollback (reqs a pipeline deployment)
    new LambdaDeploymentGroup(this,'ldp',{
      application:la,
      alias:alias,
      // deploymentConfig:LambdaDeploymentConfig.ALL_AT_ONCE, // for easier dev work
      deploymentConfig:LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
      autoRollback:{
        failedDeployment:true,
        deploymentInAlarm:false, //TODO alarms....
      },
      alarms:[
        clientSideAlarm
      ]
    })

    const oai = new OriginAccessIdentity(this,'oai',{
    })
    new CfnOutput(this,'originAccessIdentityName',{
      value:oai.originAccessIdentityName // this value needs to be manually passed to the edge bucket stack once created so that cloudfront can access them
    })
    bucket.grantRead(oai)

    if(props.hostedZoneId){
      
    //idea is to find the closest bucket from the edge entry point so that the lambda can re-route the s3 request to said bucket
    //  (this could also require us to also use the edge req for assets ?, or let 1 person take the cache miss, and then everyone is fine?)
    // todo: set this in a separate repo as a generic tool -> 2 endpoints. 1 for all aws regions, 1 for all og regions (ie: non-opt in)
    // simple tool for figuring out which region to use...maybe also a simple website-> make use of cloudfront headers? an echo service?
      [
        props.env?.region||'',
        ...(props.regions||[])
      ].forEach(region => {
        new CfnRecordSet(this, `MyCfnRecordSet${region}`, {
          name: `bucket.${props.domain}`,
          type: 'TXT',
          hostedZoneId: props.hostedZoneId,
          region: region,
          resourceRecords: [`"${region}"`],
          setIdentifier: region,
          ttl: Duration.hours(1).toSeconds().toString(),  // want to keep the number of DNS requests low to keep costs down
        })
      })
    }

    const dist = new CloudFrontWebDistribution(this,'dist',{
      originConfigs:[
        {
          behaviors:[
            {
              //cache chunks for ever since they get unique urls per build (ignoring the test page)
              isDefaultBehavior:true,
              defaultTtl:Duration.days(365),
              // this lambda can be omitted to reduce lambda + route53 queries at the cost of increased cache miss origin latency issues
              // if you run canaries against your edge regions (like AWS does) , this should not be needed (since the canary will most likely take the performance hit)
              lambdaFunctionAssociations:[{
                eventType:LambdaEdgeEventType.ORIGIN_REQUEST,
                lambdaFunction:chunkEdgeLambda.currentVersion
              }],              
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
    new CfnOutput(this,'CloudFrontWebDistribution',{
      value:dist.distributionDomainName
    })

    this.createMetricsPostbackApi()
   
  }

  /**
   * create an api gateway to have the client app send back metrics to
   * this will publish the metrics used for the rollback alarm during the blue-green deployment
   * 
   * if an error were to surface AFTER the deployment has succeeded, one would have to manually initiate the rollback
   * @returns 
   */
  createMetricsPostbackApi():{api:HttpApi}{
   const metricFn= new Function(this,'metricApiFunction',{
      code:Code.fromAsset(__dirname + '/../api'),
      handler:'index.handler',
      runtime:Runtime.NODEJS_14_X,
      environment: {
        NAMESPACE
      },
      initialPolicy:[new PolicyStatement({
        effect: Effect.ALLOW,
        actions:['cloudwatch:PutMetricData'],
        resources:['*'],
        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/iam-cw-condition-keys-namespace.html
        conditions:{
            StringEquals: {
                'cloudwatch:namespace': NAMESPACE
            }
        }
      })]
    })

    const api = new HttpApi(this,'metricApi',{
      createDefaultStage:false,
    })

    const stage = 'api'
    api.addStage(stage,{autoDeploy:true,stageName:stage,})
    api.addRoutes({
      path: '/metric',
      methods: [ HttpMethod.POST ],
      integration:  new HttpLambdaIntegration('metricFnIntg', metricFn)
    })

    new CfnOutput(this,'metricApiDomain',{
      value:`https://${api.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`
    })

    return {
      api
    }
   
  }

}
