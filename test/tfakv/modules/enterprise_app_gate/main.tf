terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = ">= 2.47.0"
    }
    null = {
      source  = "hashicorp/null"
      version = ">= 3.2.2"
    }
  }
}

data "azuread_service_principal" "target" {
  object_id = var.sp_object_id
}

# Compute role ID: prefer explicit var.app_role_id; else resolve by display name from SP's app roles
locals {
  resolved_role_id = coalesce(
    var.app_role_id,
    try([for r in data.azuread_service_principal.target.app_roles : r.id if r.display_name == var.app_role_display_name][0], null)
  )
}

# Create the security group used to gate access
resource "azuread_group" "gate" {
  display_name     = var.group_name
  security_enabled = true
}

# Toggle "User assignment required" on the Enterprise App (Service Principal)
# Uses Azure CLI because azuread provider cannot flip this on a data-only SP without importing as a resource.
resource "null_resource" "enable_assignment_required" {
  triggers = {
    sp_object_id = var.sp_object_id
  }

  provisioner "local-exec" {
    command = "az ad sp update --id ${var.sp_object_id} --set appRoleAssignmentRequired=true"
    interpreter = ["/bin/sh", "-c"]
  }
}

# Assign the group to the Enterprise App with the Default Access role
resource "azuread_app_role_assignment" "gate_assignment" {
  principal_object_id = azuread_group.gate.object_id
  resource_object_id  = var.sp_object_id
  app_role_id         = local.resolved_role_id

  depends_on = [null_resource.enable_assignment_required]
}
