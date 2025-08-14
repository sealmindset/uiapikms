# outputs.tf — surfaces IDs/URIs for export scripts and CI pipelines

# Current Azure context (the credentials Terraform is using)
#data "azurerm_client_config" "current" {}

output "subscription_id" {
  description = "Azure subscription GUID for the current account"
  value       = data.azurerm_client_config.current.subscription_id
}

#output "tenant_id" {
#  description = "Azure Active Directory tenant ID"
#  value       = data.azuread_client_config.current.tenant_id
#}

# Service Principal outputs (created in this stack)
#output "service_principal_client_id" {
#  description = "App/Client ID of the service principal"
#  value       = azuread_service_principal.sp.application_id
#}

#output "service_principal_client_secret" {
#  description = "Client secret of the service principal"
#  value       = azuread_application_password.sp_secret.value
#  sensitive   = true
#}

# Key Vault URI (if kv resource exists in this stack)
#output "key_vault_uri" {
#  description = "DNS URI of the Key Vault"
#  value       = azurerm_key_vault.kv.vault_uri
#}
