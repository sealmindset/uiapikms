module "enterprise_app_gate" {
  source = "./modules/enterprise_app_gate"

  # Use provided target SP, else fall back to the SP created in this stack
  sp_object_id = coalesce(var.target_sp_object_id, azuread_service_principal.sp.object_id)

  # OPTIONAL: Security group display name
  group_name = coalesce(var.gate_group_name, "OpenAI_APIKey")

  # OPTIONAL: App role to assign (0000.. is Default Access for most apps)
  app_role_id = coalesce(var.app_role_id, "00000000-0000-0000-0000-000000000000")
}
