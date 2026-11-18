create table public.clientes (
  id serial not null,
  nombre character varying(100) not null,
  apellido character varying(100) not null,
  cuit character varying(11) not null,
  email character varying(255) not null,
  estado boolean null default true,
  certificado_encriptado text not null,
  password_encriptada text not null,
  fecha_creacion timestamp with time zone null default now(),
  fecha_modificacion timestamp with time zone null,
  constraint clientes_pkey primary key (id),
  constraint clientes_cuit_key unique (cuit),
  constraint clientes_email_key unique (email)
) TABLESPACE pg_default;

create index IF not exists idx_clientes_cuit on public.clientes using btree (cuit) TABLESPACE pg_default;

create index IF not exists idx_clientes_email on public.clientes using btree (email) TABLESPACE pg_default;

create index IF not exists idx_clientes_estado on public.clientes using btree (estado) TABLESPACE pg_default;