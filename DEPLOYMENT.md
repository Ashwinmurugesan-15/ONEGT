# Deployment Guide

This guide covers deploying OneGT using Docker Compose and Kubernetes (Helm).

## Prerequisites

- Docker and Docker Compose (for Docker deployment)
- kubectl and Helm 3.x (for Kubernetes deployment)
- Google Cloud service account credentials

---

## Docker Compose Deployment

### 1. Prepare Configuration

```bash
# Copy environment template
cp .env.docker .env

# Edit .env and set your SPREADSHEET_ID
nano .env
```

### 2. Ensure Credentials

Make sure your `backend/credentials.json` file exists with valid Google service account credentials.

### 3. Build and Run

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### 4. Access Application

- Application: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Kubernetes Deployment (Helm)

### 1. Prepare Credentials Secret

```bash
# Encode your credentials file to base64
cat backend/credentials.json | base64 -w 0 > credentials.b64
```

### 2. Build and Push Docker Image

```bash
# Build the image
docker build -t your-registry/guhatek-onegt:1.0.0 .

# Push to your registry
docker push your-registry/guhatek-onegt:1.0.0
```

### 3. Configure values.yaml

Edit `helm/guhatek-onegt/values.yaml`:

```yaml
image:
  repository: your-registry/guhatek-onegt
  tag: "1.0.0"

env:
  SPREADSHEET_ID: "your-spreadsheet-id"

googleCredentials:
  credentialsBase64: "<content of credentials.b64>"
```

### 4. Install Helm Chart

```bash
# Create namespace
kubectl create namespace chrms

# Install with default values
helm install guhatek-onegt ./helm/guhatek-onegt -n chrms

# Or with production values
helm install guhatek-onegt ./helm/guhatek-onegt -n chrms \
  -f ./helm/guhatek-onegt/values-production.yaml \
  --set env.SPREADSHEET_ID="your-spreadsheet-id" \
  --set googleCredentials.credentialsBase64="$(cat credentials.b64)"
```

### 5. Verify Deployment

```bash
# Check pods
kubectl get pods -n chrms

# Check service
kubectl get svc -n chrms

# Check ingress
kubectl get ingress -n chrms

# View logs
kubectl logs -l app.kubernetes.io/name=guhatek-onegt -n chrms
```

### 6. Access Application

If using ingress:
- Add `chrms.guhatek.local` to your /etc/hosts or configure DNS
- Access: https://chrms.guhatek.local

If using port-forward:
```bash
kubectl port-forward svc/guhatek-onegt 8080:8000 -n chrms
# Access: http://localhost:8080
```

---

## Upgrading

### Docker Compose

```bash
docker-compose pull
docker-compose up -d --build
```

### Helm

```bash
helm upgrade guhatek-onegt ./helm/guhatek-onegt -n chrms \
  -f ./helm/guhatek-onegt/values-production.yaml
```

---

## Rollback (Helm)

```bash
# List revisions
helm history guhatek-onegt -n chrms

# Rollback to previous version
helm rollback guhatek-onegt 1 -n chrms
```

---

## Uninstall

### Docker Compose

```bash
docker-compose down -v
```

### Helm

```bash
helm uninstall guhatek-onegt -n chrms
kubectl delete namespace chrms
```

---

## Troubleshooting

### Check Backend Health

```bash
curl http://localhost:8000/health
```

### View Container Logs

```bash
# Docker
docker-compose logs -f guhatek-onegt

# Kubernetes
kubectl logs -l app.kubernetes.io/name=guhatek-onegt -n chrms -f
```

### Google Sheets Permission Error

If you see "PermissionError" or "403":
1. Verify the spreadsheet ID is correct
2. Ensure the Google Sheet is shared with the service account email
3. Check that credentials.json is properly mounted

### Pod Crashes

```bash
# Get pod events
kubectl describe pod -l app.kubernetes.io/name=guhatek-onegt -n chrms

# Check previous logs
kubectl logs -l app.kubernetes.io/name=guhatek-onegt -n chrms --previous
```
