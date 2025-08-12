locals {
  suffix = random_string.sfx.result
}

# Resource group (create if name not supplied)
resource "azurerm_resource_group" "rg" {
  count    = var.resource_group_name == null ? 1 : 0
  name     = "${var.project}-rg"
  location = var.location
}

# Use provided RG name if present, else the created one
locals {
  rg_name = var.resource_group_name != null ? var.resource_group_name : azurerm_resource_group.rg[0].name
}

resource "random_string" "sfx" {
  length  = 5
  upper   = false
  special = false
}

# Key Vault
resource "azurerm_key_vault" "kv" {
  name                       = "${var.project}-${local.suffix}-kv"
  location                   = var.location
  resource_group_name        = local.rg_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = var.enable_purge_protection
  soft_delete_retention_days = 7

  public_network_access_enabled = true
  enabled_for_deployment        = false
  enabled_for_disk_encryption   = false
  enabled_for_template_deployment = false
}

# App registration (service principal)
resource "azuread_application" "app" {
  display_name = "${var.project}-sp"
}

resource "azuread_service_principal" "sp" {
  client_id = azuread_application.app.client_id
}

# Client secret
resource "azuread_application_password" "sp_secret" {
  application_id        = azuread_application.app.id
  display_name          = "terraform-generated"
  end_date              = timeadd(timestamp(), "8760h") # 1 year
}

# Access to Key Vault - Access Policy (simpler for POC)
resource "azurerm_key_vault_access_policy" "sp_policy" {
  key_vault_id = azurerm_key_vault.kv.id

  tenant_id = data.azurerm_client_config.current.tenant_id
  object_id = azuread_service_principal.sp.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
  ]
}

# Current caller (optional read access for operator)
resource "azurerm_key_vault_access_policy" "me_policy" {
  key_vault_id = azurerm_key_vault.kv.id

  tenant_id = data.azurerm_client_config.current.tenant_id
  object_id = data.azuread_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
  ]
}

# Useful outputs
output "key_vault_name" {
  value = azurerm_key_vault.kv.name
}

output "key_vault_uri" {
  value = azurerm_key_vault.kv.vault_uri
}

output "service_principal_client_id" {
  value = azuread_application.app.client_id
}

output "service_principal_tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "service_principal_client_secret" {
  value     = azuread_application_password.sp_secret.value
  sensitive = true
}

# Data sources for current context
data "azurerm_client_config" "current" {}

data "azuread_client_config" "current" {}
