# Revision migration security review

Before deployment, review the revision RPC's privileged execution context, role grants, and row-level security against the live schema. Verify owner/editor write permissions and viewer denial with authenticated integration tests. The existing migration has not been applied to production. Do not enable synchronization until this review is complete.
