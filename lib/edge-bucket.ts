import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { OriginAccessIdentity } from "aws-cdk-lib/aws-cloudfront";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface Props extends StackProps {
    domain:string
    originAccessIdentityName?:string
  }
  
  export class EdgeBucket extends Stack {
    constructor(scope: Construct, id: string, props: Props) {
        super(scope,id,props)
        const bucket = new Bucket(this,`${props.env?.region}_assetBucket`,{
            bucketName:`${props.env?.region}-bucket.${props.domain}`,
            removalPolicy:RemovalPolicy.DESTROY
        })

        if(props.originAccessIdentityName){
            const oai = OriginAccessIdentity.fromOriginAccessIdentityName(this,`${props.env?.region}_oai`,props.originAccessIdentityName)
    
            bucket.grantRead(oai)
        }
        
    }

}