az login
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
export ARM_TENANT_ID=$(az account show --query tenantId -o tsv)

terraform init
terraform plan -out tfplan \
  -var subscription_id=${ARM_SUBSCRIPTION_ID} \
  -var tenant_id=${ARM_TENANT_ID} \
  -var gate_group_name="OpenAI_APIKey"

#terraform apply tfplan