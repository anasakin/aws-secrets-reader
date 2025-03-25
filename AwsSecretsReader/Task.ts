import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as tl from 'azure-pipelines-task-lib/task';

async function run() {
  try {
    const awsServiceConnection: string = tl.getInput('awsServiceConnection', true)!;
    const data: string = tl.getInput('data', true)!;
    const region: string = tl.getInput('region', true)!;

    const accessKeyId: string = tl.getEndpointAuthorizationParameter(awsServiceConnection, 'username', false)!;
    const secretAccessKey: string = tl.getEndpointAuthorizationParameter(awsServiceConnection, 'password', false)!;

    const client = new SecretsManagerClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const lines: string[] = data.split('\n').map((line: string) => line.trim()).filter((line: string) => line);

    for (const line of lines) {
      const [mode, secretName, keys, outputPrefix] = line.split(' => ').map((part: string) => part.trim());

      const command = new GetSecretValueCommand({ SecretId: secretName });
      const secretData = await client.send(command);
      const secretObject = JSON.parse(secretData.SecretString || '{}');

      if (mode === 'var') {
        if (keys === '*') {
          Object.keys(secretObject).forEach((key: string) => {
            console.log(`Setting variable: ${key}`);
            tl.setVariable(key, secretObject[key]);
          });
        } else {
          if (secretObject[keys]) {
            console.log(`Setting variable: ${outputPrefix}`);
            tl.setVariable(outputPrefix, secretObject[keys]);
          } else {
            throw new Error(`Key ${keys} not found in secret ${secretName}`);
          }
        }
      } else if (mode === 'pre') {
        if (keys === '*') {
          Object.keys(secretObject).forEach((key: string) => {
            const variableName = `${outputPrefix}_${key}`;
            console.log(`Setting variable: ${variableName}`);
            tl.setVariable(variableName, secretObject[key]);
          });
        } else {
          const requestedKeys = keys.split(',').map((k: string) => k.trim());
          requestedKeys.forEach((key: string) => {
            if (secretObject[key]) {
              const variableName = `${outputPrefix}_${key}`;
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
