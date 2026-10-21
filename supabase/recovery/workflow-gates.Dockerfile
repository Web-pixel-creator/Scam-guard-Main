# Test tooling only. Never receives a database URL, GitHub token or real key.
FROM python:3.11-slim@sha256:db3ff2e1800a8581e2c48a27c3995339d47bdf046da21c7627accd3d51053a93

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash jq curl ca-certificates \
    && curl --fail --silent --show-error --location \
      https://github.com/FiloSottile/age/releases/download/v1.3.1/age-v1.3.1-linux-amd64.tar.gz \
      --output /tmp/age.tar.gz \
    && echo 'bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377  /tmp/age.tar.gz' | sha256sum --check --strict \
    && tar -xzf /tmp/age.tar.gz --directory /tmp \
    && install -m 0755 /tmp/age/age /tmp/age/age-keygen /usr/local/bin/ \
    && test "$(age --version)" = v1.3.1 \
    && rm -rf /tmp/age /tmp/age.tar.gz /var/lib/apt/lists/*

WORKDIR /work
USER 10001:10001
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python3", "-B", "supabase/recovery/local_workflow_rehearsal.py"]
