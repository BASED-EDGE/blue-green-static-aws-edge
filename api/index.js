/**
 * very basic lambda handler for taking an api gateway event, parses it, and posts the metrics to cloudwatch 
 * 
 * request body is
 * {
 *   Metrics : [
 *    {
 *      all metric fields from https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatch.html#putMetricData-property
 *     }
 *   ]
 * }
 */
const {CloudWatch} = require( 'aws-sdk')

const Namespace = process.env.NAMESPACE || 'BlueGreenStaticAWSEdge'
const cw = new CloudWatch()

async function handler(event) {
    // TODO: return HTTP 403 if origin is unexpected

    // log each metric separately to allow clean querying using cloudwatch insights + include select info from the headers (ie: user-agent) ?
    console.log(JSON.stringify(event))

    const {Metrics} = JSON.parse(event.body||'')
    const results = await Promise.allSettled(
     Metrics.map(({
        MetricName,
        Dimensions,
        Unit,
        Timestamp,
        Counts,
        //StatisticValues,
        StorageResolution,
        Value,
        Values
     })=>cw.putMetricData({
        Namespace,
        MetricData:[{
            MetricName,
            Dimensions,
            Unit,
            Timestamp,
            Counts,
            //StatisticValues,
            StorageResolution,
            Value,
            Values
        }]
      }).promise()
    ))

    if(results.some(r => r.status === 'rejected')){
        const response = {
            status:'400',
            "headers": {
                "Content-Type": "application/json",
            },
            "isBase64Encoded": false,
            body:JSON.stringify({
                msg:'some metrics failed to post',
                failures: results.filter(f=> f.status === 'rejected').map((f) => f[`reason`])
            })
        }
        console.error(response)
        return response
    }

    return {
        status:'204',
    }
}


exports.handler = handler