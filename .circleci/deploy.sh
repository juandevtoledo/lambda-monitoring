#!/bin/sh

set -o nounset
set -o errexit
set -o xtrace

for current_function in "$@";
    do echo "Uploading $current_function to s3"
    aws s3 cp monitoring/$current_function.zip s3://${DEPLOY_BUCKET}/monitoring/$current_function.zip
    if [ ! -z $REPLICATION ]; then
      aws s3 cp monitoring/$current_function.zip s3://replica-${DEPLOY_BUCKET}/monitoring/$current_function.zip
    fi
    echo "Updating function: $current_function"
    aws lambda update-function-code --region ${AWS_REGION} --function-name $current_function --s3-bucket ${DEPLOY_BUCKET} --s3-key monitoring/$current_function.zip --publish  --query '{Name:FunctionName ,Version:Version}' --output table
    if [ ! -z $REPLICATION ]; then
      aws lambda update-function-code --region ${AWS_REGION_REPLICA} --function-name $current_function --s3-bucket "replica-${DEPLOY_BUCKET}" --s3-key monitoring/$current_function.zip --publish  --query '{Name:FunctionName ,Version:Version}' --output table
    fi
    echo "Finished"
done 