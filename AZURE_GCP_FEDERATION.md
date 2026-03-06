# Azure AKS to Google Cloud Workload Identity Federation

This document outlines the steps to configure Workload Identity Federation between an Azure Kubernetes Service (AKS) cluster and Google Cloud Platform (GCP). This allows workloads running in AKS to securely access GCP resources without using static service account keys.

## Prerequisites
- Azure CLI (`az`) installed and configured
- Google Cloud CLI (`gcloud`) installed and configured
- Appropriate permissions in both Azure and GCP

## Step 1: Get AKS OIDC Issuer URL

Retrieve the OIDC Issuer URL for your AKS cluster:
```bash
az aks show --name <AKS cluster name> --resource-group <resource group name> --query "oidcIssuerProfile.issuerUrl" -o tsv
```
*Note this URL, as it will be used as the `<url>` in subsequent steps.*

## Step 2: Create an Azure Managed Identity

Create a user-assigned managed identity in Azure that your AKS workloads will use:
```bash
az identity create --name onegt-identity --resource-group <resource group name>
```

Retrieve the Client ID of the newly created managed identity:
```bash
az identity show --name onegt-identity --resource-group <resource group name> --query clientId -o tsv
```

## Step 3: Configure Google Cloud Identity Pool

Authenticate and set your GCP project:
```bash
gcloud auth login
gcloud config set project <gcloud project name>
```

Create a new Workload Identity Pool in GCP:
```bash
gcloud iam workload-identity-pools create azure-aks-pool-prod \
  --location="global" \
  --display-name="Azure AKS Pool Production"
```

## Step 4: Create GCP Workload Identity Provider

Create an OIDC provider within the identity pool using the AKS OIDC Issuer URL obtained in Step 1 (replace `<url>` with the actual URL):
```bash
gcloud iam workload-identity-pools providers create-oidc aks-provider-prod \
  --location="global" \
  --workload-identity-pool="azure-aks-pool-prod" \
  --issuer-uri="<url>" \
  --allowed-audiences="api://AzureADTokenExchange" \
  --attribute-mapping="google.subject=assertion.sub"
```

## Step 5: Grant Impersonation Permissions

First, get the principal identifier of the identity pool:
```bash
POOL_ID=$(gcloud iam workload-identity-pools describe azure-aks-pool-prod \
  --location="global" --format="value(name)")
```

Then, grant the identity pool permission to impersonate the Google Service Account (`<service account id>`). There are two ways to bind this permission:

**Binding 1: By Namespace and Default Service Account**
```bash
gcloud iam service-accounts add-iam-policy-binding \
  <service account id> \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.namespace/default"
```

**Binding 2: By Specific Pool/Provider**
Get your GCP project number/ID first:
```bash
gcloud projects describe <gcloud project name>
```
Replace `{projectID}` with your project number/ID:
```bash
gcloud iam service-accounts add-iam-policy-binding \
  <service account id> \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/{projectID}/locations/global/workloadIdentityPools/azure-aks-pool-prod/*"
```

## Step 6: Create Azure Federated Credential

Link the Azure managed identity to the AKS OpenID Connect (OIDC) issuer (replace `<url>` with the AKS OIDC Issuer URL from Step 1):
```bash
az identity federated-credential create \
  --name onegt-prod-fed-cred \
  --identity-name onegt-identity \
  --resource-group <resource group name> \
  --issuer "<url>" \
  --subject "system:serviceaccount:default:guhatek-onegt" \
  --audiences "api://AzureADTokenExchange"
```

## Step 7: Generate Credential Configuration File

Finally, generate the credentials configuration file that the Google Cloud SDK will use to authenticate using the federated identity:
```bash
gcloud iam workload-identity-pools create-cred-config \
  projects/1034036271051/locations/global/workloadIdentityPools/azure-aks-pool-prod/providers/aks-provider-prod \
  --service-account=<service account id> \
  --output-file=google-credentials-config-onegt-prod.json \
  --azure
```
*Note: This output file (`google-credentials-config-onegt-prod.json`) should be made available to your workloads, e.g., by creating a Kubernetes Secret or including it in your deployment.*
