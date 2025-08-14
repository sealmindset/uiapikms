export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
export ARM_TENANT_ID=$(az account show --query tenantId -o tsv)

export AZURE_CLIENT_ID=$(terraform output -raw service_principal_client_id)
export AZURE_CLIENT_SECRET=$(terraform output -raw service_principal_client_secret)

export AZURE_KEY_VAULT_URL=$(terraform output -raw key_vault_uri)



