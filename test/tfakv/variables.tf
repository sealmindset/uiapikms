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
