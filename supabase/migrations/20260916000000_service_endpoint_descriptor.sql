-- Published provider contact details only. Themis does not proxy, call, or
-- authenticate against these endpoints; callers decide whether to contact one.
alter table public.services
  add column agent_endpoint_url text,
  add column agent_endpoint_protocol text,
  add column agent_endpoint_capabilities text[];

alter table public.services
  add constraint services_agent_endpoint_shape check (
    (
      agent_endpoint_url is null
      and agent_endpoint_protocol is null
      and agent_endpoint_capabilities is null
    )
    or (
      agent_endpoint_url ~ '^https://'
      and agent_endpoint_protocol = 'themis-service-endpoint-v1'
      and cardinality(agent_endpoint_capabilities) between 1 and 3
      and agent_endpoint_capabilities <@ array['INQUIRY', 'MATTER_INTAKE', 'SERVICE_MESSAGE']::text[]
    )
  );
