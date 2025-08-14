# `tfakv` – Local Key Vault & SP stack

This directory spins up a Key Vault and a Service Principal for dev/test automation.

---
## Workflow

1. **Login & set context**
   ```bash
   az login                          # browser/device code
   az account set -s <SUBSCRIPTION_ID>
   # or export env vars for provider autodetect
   export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
   export ARM_TENANT_ID=$(az account show --query tenantId -o tsv)
   ```

2. **Terraform plan/apply**
   ```bash
   terraform init
   terraform plan -out tfplan \
     -var subscription_id=${ARM_SUBSCRIPTION_ID} \
     -var tenant_id=${ARM_TENANT_ID}
   terraform apply tfplan
   ```

3. **Export outputs for apps/CI**
   ```bash
   source ./exportaz.sh
   # env vars now: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_KEY_VAULT_URL
   ```

4. **Destroy** when finished
   ```bash
   terraform destroy -auto-approve
   ```

## Enterprise App Gate (User assignment required)

This enforces that only members of a specific Entra ID group (e.g., `OpenAI_APIKey`) can sign in to your Enterprise App.

1. **Prereqs**
   - Logged in and in the correct tenant
     ```bash
     az login
     export ARM_TENANT_ID=$(az account show --query tenantId -o tsv)
     export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
     ```
   - Get your Enterprise App (Service Principal) objectId
     ```bash
     # If you know the App Registration (client) ID
     APP_ID="<your-app-registration-client-id>"
     SP_OBJECT_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)
     echo $SP_OBJECT_ID
     # Or set it directly if you have it from the portal
     # SP_OBJECT_ID="<service-principal-object-id>"
     ```

2. **Apply the gate (Option A: CLI -var inputs)**
   ```bash
   terraform init

   terraform plan -out tfplan \
     -var subscription_id=${ARM_SUBSCRIPTION_ID} \
     -var tenant_id=${ARM_TENANT_ID} \
     -var target_sp_object_id="${SP_OBJECT_ID}" \
     -var gate_group_name="OpenAI_APIKey"

   terraform apply tfplan
   ```

3. **Verify in portal**
   - Enterprise applications → your app → Properties → User assignment required = Yes
   - Enterprise applications → your app → Users and groups → `OpenAI_APIKey` assigned

4. **Teardown**
   ```bash
   terraform destroy -auto-approve
   ```

---
Keep this README updated if variable names or script behavior change.
