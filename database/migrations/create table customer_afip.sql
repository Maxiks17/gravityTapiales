create table public.customers_afip (
  id serial not null,
  nombre character varying(100) not null,
  apellido character varying(100) not null,
  cuit character varying(11) not null,
  email character varying(255) not null,
  estado boolean null default true,
  certificado_encriptado text not null,
  certificado_private_key_encriptada text not null,
  fecha_creacion timestamp with time zone null default now(),
  fecha_modificacion timestamp with time zone null,
  token text null,
  sign text null,
  tenant_id uuid null,
  "expiration_Token" timestamp with time zone null,
  constraint clientes_pkey primary key (id),
  constraint clientes_cuit_key unique (cuit),
  constraint customers_afip_tenant_id_fkey foreign KEY (tenant_id) references tenants (id)
) TABLESPACE pg_default;

create index IF not exists idx_clientes_cuit on public.customers_afip using btree (cuit) TABLESPACE pg_default;

create index IF not exists idx_clientes_email on public.customers_afip using btree (email) TABLESPACE pg_default;

create index IF not exists idx_clientes_estado on public.customers_afip using btree (estado) TABLESPACE pg_default;