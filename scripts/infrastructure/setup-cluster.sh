#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Environment variables
CLUSTER_NAME=$1
ENVIRONMENT=$2
REGION="us-central1"
ZONE="us-central1-a"
MACHINE_TYPE="n2-standard-2"

if [ -z "$CLUSTER_NAME" ] || [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Usage: $0 <cluster-name> <environment>${NC}"
    exit 1
fi

echo -e "${GREEN}Setting up Kubernetes cluster for Rada - $ENVIRONMENT${NC}"
echo "=================================================="

# Create GKE cluster
echo -e "\n${YELLOW}Creating GKE cluster...${NC}"
gcloud container clusters create "$CLUSTER_NAME" \
    --zone "$ZONE" \
    --machine-type "$MACHINE_TYPE" \
    --num-nodes 3 \
    --enable-autoscaling \
    --min-nodes 3 \
    --max-nodes 10 \
    --enable-autorepair \
    --enable-autoupgrade \
    --enable-ip-alias \
    --workload-pool="$PROJECT_ID.svc.id.goog" \
    --enable-master-authorized-networks \
    --enable-network-policy \
    --enable-pod-security-policy

# Get credentials
echo -e "\n${YELLOW}Getting cluster credentials...${NC}"
gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$ZONE"

# Create namespace
echo -e "\n${YELLOW}Creating namespace...${NC}"
kubectl create namespace "$ENVIRONMENT"

# Label namespace for network policies
kubectl label namespace "$ENVIRONMENT" name="$ENVIRONMENT"

# Install Helm
echo -e "\n${YELLOW}Installing Helm...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install Prometheus Operator
echo -e "\n${YELLOW}Installing Prometheus Operator...${NC}"
helm install prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace \
    --set grafana.adminPassword="$GRAFANA_PASSWORD"

# Install Nginx Ingress Controller
echo -e "\n${YELLOW}Installing NGINX Ingress Controller...${NC}"
helm install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --set controller.metrics.enabled=true \
    --set controller.metrics.serviceMonitor.enabled=true

# Apply base configurations
echo -e "\n${YELLOW}Applying base configurations...${NC}"
kubectl apply -k k8s/base

# Create SSL certificate
echo -e "\n${YELLOW}Creating SSL certificate...${NC}"
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: rada-tls
  namespace: $ENVIRONMENT
spec:
  secretName: rada-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - api.rada.co.ke
  - www.rada.co.ke
EOF

# Setup RBAC
echo -e "\n${YELLOW}Setting up RBAC...${NC}"
kubectl apply -f k8s/base/security-policies.yaml

# Create backup storage
echo -e "\n${YELLOW}Setting up backup storage...${NC}"
gsutil mb -l "$REGION" gs://rada-backups-"$ENVIRONMENT"

# Print cluster info
echo -e "\n${GREEN}Cluster setup complete!${NC}"
echo -e "Cluster name: ${YELLOW}$CLUSTER_NAME${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$REGION${NC}"
echo -e "Zone: ${YELLOW}$ZONE${NC}"

echo -e "\n${GREEN}Next steps:${NC}"
echo "1. Configure DNS records to point to the Ingress IP"
echo "2. Setup monitoring alerts in Grafana"
echo "3. Configure backup retention policies"
echo "4. Review security policies"
echo "5. Setup CI/CD pipelines"

# Get cluster credentials for GitHub Actions
echo -e "\n${YELLOW}Getting kubeconfig for GitHub Actions...${NC}"
gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --zone "$ZONE" \
    --project "$PROJECT_ID" \
    | base64 | tr -d '\n' > "kubeconfig-$ENVIRONMENT.txt"

echo -e "\n${GREEN}Kubeconfig saved to kubeconfig-$ENVIRONMENT.txt${NC}"
echo "Add this as a secret in GitHub with the name KUBE_CONFIG_$ENVIRONMENT"
