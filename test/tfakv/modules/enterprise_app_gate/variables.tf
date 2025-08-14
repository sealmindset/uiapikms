variable "group_name" {
  description = "Display name of the Entra ID security group to gate access"
  type        = string
  default     = "OpenAI_APIKey"
}

variable "sp_object_id" {
  description = "Object ID of the Enterprise App (Service Principal) to gate"
  type        = string
}

variable "app_role_id" {
  description = "App role ID to assign (Default Access role GUID used by most apps)."
  type        = string
  default     = "00000000-0000-0000-0000-000000000000"
}

variable "app_role_display_name" {
  description = "Display name of the app role to resolve when app_role_id is not provided (e.g., 'Default Access')."
  type        = string
  default     = "Default Access"
}
