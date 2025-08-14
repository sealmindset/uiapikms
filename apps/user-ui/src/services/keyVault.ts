import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Accept either AZURE_KEY_VAULT_URL (preferred) or legacy AZURE_KEY_VAULT_URI for compatibility
const kvUrl = process.env.AZURE_KEY_VAULT_URL || process.env.AZURE_KEY_VAULT_URI || '';
let client: SecretClient | null = null;

export function getSecretClient(): SecretClient {
  if (!client) {
    if (!kvUrl) {
      throw new Error('Key Vault URL is not configured (set AZURE_KEY_VAULT_URL or AZURE_KEY_VAULT_URI)');
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
