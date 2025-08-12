import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const kvUrl = process.env.AZURE_KEY_VAULT_URL || '';
let client: SecretClient | null = null;

export function getSecretClient(): SecretClient {
  if (!client) {
    if (!kvUrl) {
      throw new Error('AZURE_KEY_VAULT_URL is not set');
    }
    const credential = new DefaultAzureCredential();
    client = new SecretClient(kvUrl, credential);
  }
  return client;
}

export async function storeApiKey(secretName: string, value: string): Promise<string> {
  const c = getSecretClient();
  const result = await c.setSecret(secretName, value);
  // return the identifier that we will store in Postgres (name + version)
  return `${result.name}::${result.properties.version ?? ''}`;
}
