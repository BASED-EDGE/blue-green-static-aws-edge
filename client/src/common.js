export const METRIC_NAME = 'clientSideError'    

export function postErrorMetric(errorOccurred){
    const Value = errorOccurred ? 1 : 0
    // consider using fetch instead (https://chromestatus.com/feature/5629709824032768)
    navigator.sendBeacon('https://bqfh0ngg62.execute-api.us-east-1.amazonaws.com/api/metric',
        JSON.stringify({Metrics:[
            {
                MetricName:'clientSideError',
                Timestamp: new Date(),
                Unit:'Count',
                Value,
            }
        ]}
    ))
}