# Voice AI Platform - Deployment Guide

## Quick Start (Local Development)

### Docker Compose

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill in your API keys in .env file

# 3. Start all services
docker-compose up -d

# 4. Check health
curl http://localhost:3000/monitoring/health/ready

# 5. Access services
# API: http://localhost:3000
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

## Production Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Docker registry access
- Domain name with DNS configured

### 1. Build and Push Docker Image

```bash
# Build
docker build -t your-registry/voice-ai-api:v1.0.0 ./apps/api

# Push
docker push your-registry/voice-ai-api:v1.0.0
```

### 2. Create Namespace

```bash
kubectl create namespace voice-ai
```

### 3. Configure Secrets

```bash
# Option 1: From file
kubectl apply -f k8s/secrets.yaml -n voice-ai

# Option 2: From command line
kubectl create secret generic voice-ai-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/db" \
  --from-literal=redis-url="redis://host:6379" \
  --from-literal=openai-api-key="sk-..." \
  --from-literal=deepgram-api-key="..." \
  --from-literal=jwt-secret="your-secret" \
  --from-literal=api-key-secret="your-secret" \
  -n voice-ai
```

### 4. Deploy Database (if needed)

```bash
# Deploy PostgreSQL
kubectl apply -f k8s/postgres.yaml -n voice-ai

# Deploy Redis
kubectl apply -f k8s/redis.yaml -n voice-ai

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n voice-ai --timeout=300s
```

### 5. Deploy Application

```bash
# Deploy API
kubectl apply -f k8s/deployment.yaml -n voice-ai

# Deploy Ingress
kubectl apply -f k8s/ingress.yaml -n voice-ai

# Check deployment status
kubectl rollout status deployment/voice-ai-api -n voice-ai
```

### 6. Verify Deployment

```bash
# Check pods
kubectl get pods -n voice-ai

# Check logs
kubectl logs -f deployment/voice-ai-api -n voice-ai

# Test health endpoint
kubectl port-forward svc/voice-ai-api 3000:3000 -n voice-ai
curl http://localhost:3000/monitoring/health/ready
```

## CI/CD Setup

### GitHub Actions

1. Configure secrets in GitHub repository:
   - `KUBECONFIG`: Base64 encoded kubeconfig file
   - `REGISTRY_USERNAME`: Docker registry username
   - `REGISTRY_PASSWORD`: Docker registry password

2. Push to main branch triggers deployment:
```bash
git push origin main
```

## Monitoring

### Prometheus

Access Prometheus:
```bash
kubectl port-forward svc/prometheus 9090:9090 -n voice-ai
# Open http://localhost:9090
```

### Grafana

Access Grafana:
```bash
kubectl port-forward svc/grafana 3000:3000 -n voice-ai
# Open http://localhost:3000 (admin/admin)
```

## Scaling

### Horizontal Pod Autoscaling

```bash
kubectl autoscale deployment voice-ai-api \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n voice-ai
```

### Manual Scaling

```bash
kubectl scale deployment voice-ai-api --replicas=5 -n voice-ai
```

## Database Migrations

```bash
# Run migrations
kubectl exec -it deployment/voice-ai-api -n voice-ai -- \
  npm run migrate

# Or manually
kubectl exec -it deployment/voice-ai-api -n voice-ai -- sh
cd dist/db
psql $DATABASE_URL -f schema.sql
```

## Troubleshooting

### Check Logs

```bash
# Application logs
kubectl logs -f deployment/voice-ai-api -n voice-ai

# Recent logs
kubectl logs --tail=100 deployment/voice-ai-api -n voice-ai

# Specific pod
kubectl logs -f pod/voice-ai-api-xyz123 -n voice-ai
```

### Debug Pod

```bash
kubectl exec -it deployment/voice-ai-api -n voice-ai -- sh
```

### Check Resources

```bash
kubectl top pods -n voice-ai
kubectl top nodes
```

### Common Issues

**Pod CrashLoopBackOff**
```bash
kubectl describe pod <pod-name> -n voice-ai
kubectl logs <pod-name> -n voice-ai --previous
```

**Database Connection Failed**
```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql $DATABASE_URL
```

**Secrets Not Found**
```bash
kubectl get secrets -n voice-ai
kubectl describe secret voice-ai-secrets -n voice-ai
```

## Backup & Recovery

### Database Backup

```bash
# Backup
kubectl exec deployment/postgres -n voice-ai -- \
  pg_dump -U postgres voice_ai > backup.sql

# Restore
kubectl exec -i deployment/postgres -n voice-ai -- \
  psql -U postgres voice_ai < backup.sql
```

### Configuration Backup

```bash
# Export all resources
kubectl get all -n voice-ai -o yaml > backup-resources.yaml
kubectl get secrets -n voice-ai -o yaml > backup-secrets.yaml
kubectl get configmaps -n voice-ai -o yaml > backup-configmaps.yaml
```

## Performance Tuning

### Database Connection Pooling

Adjust in environment variables:
```yaml
- name: DB_POOL_MIN
  value: "2"
- name: DB_POOL_MAX
  value: "20"
```

### Redis Memory

```bash
kubectl set resources deployment/redis \
  --limits=memory=512Mi \
  --requests=memory=256Mi \
  -n voice-ai
```

## Security Best Practices

1. Use private Docker registry
2. Enable Pod Security Standards
3. Use Network Policies
4. Rotate secrets regularly
5. Enable RBAC
6. Use TLS for all services
7. Regular security updates

## Cost Optimization

1. Use node autoscaling
2. Set appropriate resource limits
3. Use spot/preemptible instances
4. Monitor and optimize API costs
5. Cache frequently accessed data

## Support

For issues or questions:
- Check logs: `kubectl logs -f deployment/voice-ai-api -n voice-ai`
- Health check: `kubectl get pods -n voice-ai`
- Metrics: http://your-domain/monitoring/metrics
