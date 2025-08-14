variable "project" {
  description = "Short name used to tag and name resources"
  type        = string
  default     = "uiapikms"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Optional name for the resource group"
  type        = string
  default     = null
}

variable "enable_purge_protection" {
  description = "Whether to enable purge protection on the Key Vault (recommended in prod)."
  type        = bool
  default     = false
}

# Azure context – if not set, provider will fall back to ARM_* env vars or Azure CLI context
variable "subscription_id" {
  description = "Azure subscription GUID to deploy resources into"
  type        = string
  default     = null
}

variable "tenant_id" {
  description = "Azure Active Directory tenant GUID"
  type        = string
  default     = null
}

## Enterprise App gate module inputs
variable "target_sp_object_id" {
  description = "Object ID of the Enterprise App (Service Principal) to gate with user assignment required"
  type        = string
  default     = null
}

variable "gate_group_name" {
  description = "Display name for the security group that gates access"
  type        = string
  default     = null
}

variable "app_role_id" {
  description = "App role ID to assign to the group (Default Access if unspecified)"
  type        = string
  default     = null
}

