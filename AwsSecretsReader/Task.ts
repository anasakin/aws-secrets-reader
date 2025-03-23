import AWS from 'aws-sdk';
import * as tl from 'azure-pipelines-task-lib/task';

async function run() {
  try {
    const awsServiceConnection: string = tl.getInput('awsServiceConnection', true)!;
    const data: string = tl.getInput('data', true)!;
    const region: string = tl.getInput('region', true)!;

    // Configure AWS SDK using Service Connection
    const accessKeyId: string = tl.getEndpointAuthorizationParameter(awsServiceConnection, 'username', false)!;
    const secretAccessKey: string = tl.getEndpointAuthorizationParameter(awsServiceConnection, 'password', false)!;

    AWS.config.update({
      region,
      credentials: new AWS.Credentials(accessKeyId, secretAccessKey)
    });

    const secretsManager = new AWS.SecretsManager();

    const lines: string[] = data.split('\n').map((line: string) => line.trim()).filter((line: string) => line);

    for (const line of lines) {
      const [mode, secretName, keys, outputPrefix] = line.split(' => ').map((part: string) => part.trim());

      const secretData = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      const secretObject = JSON.parse(secretData.SecretString?.toString() || '{}');

      if (mode === 'var') {
        // Wildcard (*) means setting variable for each key in the secret
        if (keys === '*') {
          Object.keys(secretObject).forEach((key: string) => {
            const variableName: string = key; // Variable name = key in the secret
            console.log(`Setting variable: ${variableName}`);
            tl.setVariable(variableName, secretObject[key]);
          });
        } else {
          const key: string = keys;
          if (secretObject[key]) {
            const variableName: string = outputPrefix;
            console.log(`Setting variable: ${variableName}`);
            tl.setVariable(variableName, secretObject[key]);
          } else {
            throw new Error(`Key ${key} not found in secret ${secretName}`);
          }
        }
      } else if (mode === 'pre') {
        // Wildcard (*) means adding prefix to each key and setting variable as prefix_key
        if (keys === '*') {
          Object.keys(secretObject).forEach((key: string) => {
            const variableName: string = `${outputPrefix}_${key}`;
            console.log(`Setting variable: ${variableName}`);
            tl.setVariable(variableName, secretObject[key]);
          });
        } else {
          const requestedKeys: string[] = keys.split(',').map((k: string) => k.trim());
          requestedKeys.forEach((key: string) => {
            if (secretObject[key]) {
              const variableName: string = `${outputPrefix}_${key}`;
              console.log(`Setting variable: ${variableName}`);
              tl.setVariable(variableName, secretObject[key]);
            } else {
              throw new Error(`Key ${key} not found in secret ${secretName}`);
            }
          });
        }
      } else {
        throw new Error(`Unsupported mode: ${mode}`);
      }
    }

    console.log('All secrets set as Azure DevOps variables successfully.');
  } catch (error: unknown) {
    if (error instanceof Error) {
      tl.setResult(tl.TaskResult.Failed, error.message);
    } else {
      tl.setResult(tl.TaskResult.Failed, 'An unknown error occurred');
    }
  }
}

run();
