Run these in your zsh terminal to set subscription and export env vars Terraform reads:

Set your subscription in Azure CLI: 

az account set -s 0a48

Export ARM env vars so azurerm is unambiguous: 

export ARM_SUBSCRIPTION_ID=0a481 
export ARM_TENANT_ID=$(az account show --query tenantId -o tsv)

Re-run: terraform plan -out tfplan
