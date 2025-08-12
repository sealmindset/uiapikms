export AZURE_KEY_VAULT_URL=$(terraform output -raw key_vault_uri)
export AZURE_TENANT_ID=$(terraform output -raw service_principal_tenant_id)
export AZURE_CLIENT_ID=$(terraform output -raw service_principal_client_id)
export AZURE_CLIENT_SECRET=$(terraform output -raw service_principal_client_secret)

