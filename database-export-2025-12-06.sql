--
-- PostgreSQL database dump
--

\restrict Kzm0oLhqbv5IgPJ6G2tENnRf8ccqDoWLVyZ7nFSyux7ZLaNWy0vT2LMtrZ2vEPk

-- Dumped from database version 13.22
-- Dumped by pg_dump version 13.22

-- Started on 2025-12-06 18:43:08

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_role_id_roles_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.suppliers DROP CONSTRAINT IF EXISTS suppliers_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.suppliers DROP CONSTRAINT IF EXISTS suppliers_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.skus DROP CONSTRAINT IF EXISTS skus_product_id_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.skus DROP CONSTRAINT IF EXISTS skus_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_roles_id_fk;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_reviewed_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_requested_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_requested_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_requested_by_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_processed_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_category_id_categories_id_fk;
ALTER TABLE IF EXISTS ONLY public.product_modifiers DROP CONSTRAINT IF EXISTS product_modifiers_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.product_modifiers DROP CONSTRAINT IF EXISTS product_modifiers_modifier_id_modifiers_id_fk;
ALTER TABLE IF EXISTS ONLY public.product_import_batches DROP CONSTRAINT IF EXISTS product_import_batches_uploaded_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.product_assignments DROP CONSTRAINT IF EXISTS product_assignments_performed_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.product_assignments DROP CONSTRAINT IF EXISTS product_assignments_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_settings DROP CONSTRAINT IF EXISTS organization_settings_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_products DROP CONSTRAINT IF EXISTS organization_products_updated_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_products DROP CONSTRAINT IF EXISTS organization_products_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_products DROP CONSTRAINT IF EXISTS organization_products_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_inventory DROP CONSTRAINT IF EXISTS organization_inventory_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_inventory DROP CONSTRAINT IF EXISTS organization_inventory_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.organization_inventory DROP CONSTRAINT IF EXISTS organization_inventory_assigned_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.org_metrics DROP CONSTRAINT IF EXISTS org_metrics_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_created_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.modifiers DROP CONSTRAINT IF EXISTS modifiers_created_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.mfa_codes DROP CONSTRAINT IF EXISTS mfa_codes_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.inventory_sync_logs DROP CONSTRAINT IF EXISTS inventory_sync_logs_performed_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_sku_id_skus_id_fk;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.head_offices DROP CONSTRAINT IF EXISTS head_offices_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.global_products DROP CONSTRAINT IF EXISTS global_products_created_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.global_products DROP CONSTRAINT IF EXISTS global_products_category_id_categories_id_fk;
ALTER TABLE IF EXISTS ONLY public.employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_created_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.budgets DROP CONSTRAINT IF EXISTS budgets_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.budgets DROP CONSTRAINT IF EXISTS budgets_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.branches DROP CONSTRAINT IF EXISTS branches_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_updated_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_organization_product_id_organization_products_i;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_global_product_id_global_products_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_organization_inventory_id_organization_invento;
ALTER TABLE IF EXISTS ONLY public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_branch_id_branches_id_fk;
ALTER TABLE IF EXISTS ONLY public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_assigned_by_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_organization_id_organizations_id_fk;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_branch_id_branches_id_fk;
DROP INDEX IF EXISTS public.users_role_idx;
DROP INDEX IF EXISTS public.users_org_idx;
DROP INDEX IF EXISTS public.users_email_idx;
DROP INDEX IF EXISTS public.users_branch_idx;
DROP INDEX IF EXISTS public.users_active_idx;
DROP INDEX IF EXISTS public.suppliers_org_idx;
DROP INDEX IF EXISTS public.suppliers_name_idx;
DROP INDEX IF EXISTS public.suppliers_branch_idx;
DROP INDEX IF EXISTS public.skus_sku_idx;
DROP INDEX IF EXISTS public.skus_product_idx;
DROP INDEX IF EXISTS public.skus_org_idx;
DROP INDEX IF EXISTS public.sessions_user_idx;
DROP INDEX IF EXISTS public.sessions_org_idx;
DROP INDEX IF EXISTS public.sessions_expires_idx;
DROP INDEX IF EXISTS public.roles_name_idx;
DROP INDEX IF EXISTS public.role_permissions_role_idx;
DROP INDEX IF EXISTS public.restock_requests_status_idx;
DROP INDEX IF EXISTS public.restock_requests_requested_by_idx;
DROP INDEX IF EXISTS public.restock_requests_product_idx;
DROP INDEX IF EXISTS public.restock_requests_org_idx;
DROP INDEX IF EXISTS public.restock_requests_branch_idx;
DROP INDEX IF EXISTS public.refunds_processed_by_idx;
DROP INDEX IF EXISTS public.refunds_org_idx;
DROP INDEX IF EXISTS public.refunds_order_idx;
DROP INDEX IF EXISTS public.products_org_idx;
DROP INDEX IF EXISTS public.products_name_idx;
DROP INDEX IF EXISTS public.products_category_idx;
DROP INDEX IF EXISTS public.product_modifiers_product_modifier_idx;
DROP INDEX IF EXISTS public.product_modifiers_product_idx;
DROP INDEX IF EXISTS public.product_modifiers_modifier_idx;
DROP INDEX IF EXISTS public.product_import_batches_user_idx;
DROP INDEX IF EXISTS public.product_import_batches_status_idx;
DROP INDEX IF EXISTS public.product_import_batches_created_at_idx;
DROP INDEX IF EXISTS public.product_assignments_user_idx;
DROP INDEX IF EXISTS public.product_assignments_product_idx;
DROP INDEX IF EXISTS public.product_assignments_assigned_to_idx;
DROP INDEX IF EXISTS public.org_status_idx;
DROP INDEX IF EXISTS public.org_settings_org_idx;
DROP INDEX IF EXISTS public.org_products_org_product_uq;
DROP INDEX IF EXISTS public.org_products_org_idx;
DROP INDEX IF EXISTS public.org_products_global_idx;
DROP INDEX IF EXISTS public.org_products_enabled_idx;
DROP INDEX IF EXISTS public.org_name_idx;
DROP INDEX IF EXISTS public.org_metrics_org_idx;
DROP INDEX IF EXISTS public.org_inventory_org_product_uq;
DROP INDEX IF EXISTS public.org_inventory_org_idx;
DROP INDEX IF EXISTS public.org_inventory_global_product_idx;
DROP INDEX IF EXISTS public.org_inventory_deleted_at_idx;
DROP INDEX IF EXISTS public.org_inventory_assigned_by_idx;
DROP INDEX IF EXISTS public.org_inventory_active_idx;
DROP INDEX IF EXISTS public.orders_tid_idx;
DROP INDEX IF EXISTS public.orders_status_idx;
DROP INDEX IF EXISTS public.orders_org_idx;
DROP INDEX IF EXISTS public.orders_org_branch_status_idx;
DROP INDEX IF EXISTS public.orders_created_idx;
DROP INDEX IF EXISTS public.orders_branch_idx;
DROP INDEX IF EXISTS public.order_items_product_idx;
DROP INDEX IF EXISTS public.order_items_org_idx;
DROP INDEX IF EXISTS public.order_items_order_idx;
DROP INDEX IF EXISTS public.notifications_user_idx;
DROP INDEX IF EXISTS public.notifications_type_idx;
DROP INDEX IF EXISTS public.notifications_org_idx;
DROP INDEX IF EXISTS public.notifications_branch_idx;
DROP INDEX IF EXISTS public.modifiers_user_idx;
DROP INDEX IF EXISTS public.modifiers_type_idx;
DROP INDEX IF EXISTS public.modifiers_status_idx;
DROP INDEX IF EXISTS public.modifiers_name_idx;
DROP INDEX IF EXISTS public.mfa_codes_user_idx;
DROP INDEX IF EXISTS public.mfa_codes_type_idx;
DROP INDEX IF EXISTS public.mfa_codes_expires_idx;
DROP INDEX IF EXISTS public.mfa_codes_code_idx;
DROP INDEX IF EXISTS public.inventory_sync_logs_user_idx;
DROP INDEX IF EXISTS public.inventory_sync_logs_type_idx;
DROP INDEX IF EXISTS public.inventory_sync_logs_target_idx;
DROP INDEX IF EXISTS public.inventory_sync_logs_status_idx;
DROP INDEX IF EXISTS public.inventory_sync_logs_started_at_idx;
DROP INDEX IF EXISTS public.inventory_org_idx;
DROP INDEX IF EXISTS public.inventory_org_branch_sku_idx;
DROP INDEX IF EXISTS public.inventory_branch_sku_uq;
DROP INDEX IF EXISTS public.inventory_branch_idx;
DROP INDEX IF EXISTS public.head_offices_org_idx;
DROP INDEX IF EXISTS public.global_products_status_idx;
DROP INDEX IF EXISTS public.global_products_name_idx;
DROP INDEX IF EXISTS public.global_products_code_idx;
DROP INDEX IF EXISTS public.global_products_category_idx;
DROP INDEX IF EXISTS public.employee_creds_org_idx;
DROP INDEX IF EXISTS public.employee_creds_email_uq;
DROP INDEX IF EXISTS public.employee_creds_created_by_idx;
DROP INDEX IF EXISTS public.employee_creds_branch_idx;
DROP INDEX IF EXISTS public.employee_creds_active_idx;
DROP INDEX IF EXISTS public.categories_org_idx;
DROP INDEX IF EXISTS public.categories_name_idx;
DROP INDEX IF EXISTS public.budgets_org_idx;
DROP INDEX IF EXISTS public.budgets_branch_period_uq;
DROP INDEX IF EXISTS public.budgets_branch_idx;
DROP INDEX IF EXISTS public.branches_status_idx;
DROP INDEX IF EXISTS public.branches_org_idx;
DROP INDEX IF EXISTS public.branches_name_idx;
DROP INDEX IF EXISTS public.branch_products_visible_idx;
DROP INDEX IF EXISTS public.branch_products_org_product_idx;
DROP INDEX IF EXISTS public.branch_products_org_idx;
DROP INDEX IF EXISTS public.branch_products_global_idx;
DROP INDEX IF EXISTS public.branch_products_branch_product_uq;
DROP INDEX IF EXISTS public.branch_products_branch_idx;
DROP INDEX IF EXISTS public.branch_products_available_idx;
DROP INDEX IF EXISTS public.branch_inventory_visible_idx;
DROP INDEX IF EXISTS public.branch_inventory_org_inventory_idx;
DROP INDEX IF EXISTS public.branch_inventory_org_idx;
DROP INDEX IF EXISTS public.branch_inventory_deleted_at_idx;
DROP INDEX IF EXISTS public.branch_inventory_branch_org_inventory_uq;
DROP INDEX IF EXISTS public.branch_inventory_branch_idx;
DROP INDEX IF EXISTS public.branch_inventory_assigned_by_idx;
DROP INDEX IF EXISTS public.branch_inventory_active_idx;
DROP INDEX IF EXISTS public.audit_user_idx;
DROP INDEX IF EXISTS public.audit_org_idx;
DROP INDEX IF EXISTS public.audit_entity_idx;
DROP INDEX IF EXISTS public.audit_branch_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.suppliers DROP CONSTRAINT IF EXISTS suppliers_pkey;
ALTER TABLE IF EXISTS ONLY public.skus DROP CONSTRAINT IF EXISTS skus_pkey;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE IF EXISTS ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.refunds DROP CONSTRAINT IF EXISTS refunds_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.product_modifiers DROP CONSTRAINT IF EXISTS product_modifiers_pkey;
ALTER TABLE IF EXISTS ONLY public.product_import_batches DROP CONSTRAINT IF EXISTS product_import_batches_pkey;
ALTER TABLE IF EXISTS ONLY public.product_assignments DROP CONSTRAINT IF EXISTS product_assignments_pkey;
ALTER TABLE IF EXISTS ONLY public.organizations DROP CONSTRAINT IF EXISTS organizations_pkey;
ALTER TABLE IF EXISTS ONLY public.organization_settings DROP CONSTRAINT IF EXISTS organization_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.organization_products DROP CONSTRAINT IF EXISTS organization_products_pkey;
ALTER TABLE IF EXISTS ONLY public.organization_inventory DROP CONSTRAINT IF EXISTS organization_inventory_pkey;
ALTER TABLE IF EXISTS ONLY public.org_metrics DROP CONSTRAINT IF EXISTS org_metrics_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_tid_unique;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY public.order_items DROP CONSTRAINT IF EXISTS order_items_pkey;
ALTER TABLE IF EXISTS ONLY public.notifications DROP CONSTRAINT IF EXISTS notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.modifiers DROP CONSTRAINT IF EXISTS modifiers_pkey;
ALTER TABLE IF EXISTS ONLY public.mfa_codes DROP CONSTRAINT IF EXISTS mfa_codes_pkey;
ALTER TABLE IF EXISTS ONLY public.inventory_sync_logs DROP CONSTRAINT IF EXISTS inventory_sync_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.inventory DROP CONSTRAINT IF EXISTS inventory_pkey;
ALTER TABLE IF EXISTS ONLY public.head_offices DROP CONSTRAINT IF EXISTS head_offices_pkey;
ALTER TABLE IF EXISTS ONLY public.global_products DROP CONSTRAINT IF EXISTS global_products_pkey;
ALTER TABLE IF EXISTS ONLY public.employee_credentials DROP CONSTRAINT IF EXISTS employee_credentials_pkey;
ALTER TABLE IF EXISTS ONLY public.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE IF EXISTS ONLY public.budgets DROP CONSTRAINT IF EXISTS budgets_pkey;
ALTER TABLE IF EXISTS ONLY public.branches DROP CONSTRAINT IF EXISTS branches_pkey;
ALTER TABLE IF EXISTS ONLY public.branch_products DROP CONSTRAINT IF EXISTS branch_products_pkey;
ALTER TABLE IF EXISTS ONLY public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY drizzle.__drizzle_migrations DROP CONSTRAINT IF EXISTS __drizzle_migrations_pkey;
ALTER TABLE IF EXISTS public.suppliers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.skus ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.roles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.role_permissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.restock_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.refunds ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.product_modifiers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.product_import_batches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.product_assignments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.organizations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.organization_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.organization_products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.organization_inventory ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.org_metrics ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.order_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.modifiers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.inventory_sync_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.inventory ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.head_offices ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.global_products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.employee_credentials ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.budgets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.branches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.branch_products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.branch_inventory ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS drizzle.__drizzle_migrations ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.suppliers_id_seq;
DROP TABLE IF EXISTS public.suppliers;
DROP SEQUENCE IF EXISTS public.skus_id_seq;
DROP TABLE IF EXISTS public.skus;
DROP TABLE IF EXISTS public.sessions;
DROP SEQUENCE IF EXISTS public.roles_id_seq;
DROP TABLE IF EXISTS public.roles;
DROP SEQUENCE IF EXISTS public.role_permissions_id_seq;
DROP TABLE IF EXISTS public.role_permissions;
DROP SEQUENCE IF EXISTS public.restock_requests_id_seq;
DROP TABLE IF EXISTS public.restock_requests;
DROP SEQUENCE IF EXISTS public.refunds_id_seq;
DROP TABLE IF EXISTS public.refunds;
DROP SEQUENCE IF EXISTS public.products_id_seq;
DROP TABLE IF EXISTS public.products;
DROP SEQUENCE IF EXISTS public.product_modifiers_id_seq;
DROP TABLE IF EXISTS public.product_modifiers;
DROP SEQUENCE IF EXISTS public.product_import_batches_id_seq;
DROP TABLE IF EXISTS public.product_import_batches;
DROP SEQUENCE IF EXISTS public.product_assignments_id_seq;
DROP TABLE IF EXISTS public.product_assignments;
DROP SEQUENCE IF EXISTS public.organizations_id_seq;
DROP TABLE IF EXISTS public.organizations;
DROP SEQUENCE IF EXISTS public.organization_settings_id_seq;
DROP TABLE IF EXISTS public.organization_settings;
DROP SEQUENCE IF EXISTS public.organization_products_id_seq;
DROP TABLE IF EXISTS public.organization_products;
DROP SEQUENCE IF EXISTS public.organization_inventory_id_seq;
DROP TABLE IF EXISTS public.organization_inventory;
DROP SEQUENCE IF EXISTS public.org_metrics_id_seq;
DROP TABLE IF EXISTS public.org_metrics;
DROP SEQUENCE IF EXISTS public.orders_id_seq;
DROP TABLE IF EXISTS public.orders;
DROP SEQUENCE IF EXISTS public.order_items_id_seq;
DROP TABLE IF EXISTS public.order_items;
DROP SEQUENCE IF EXISTS public.notifications_id_seq;
DROP TABLE IF EXISTS public.notifications;
DROP SEQUENCE IF EXISTS public.modifiers_id_seq;
DROP TABLE IF EXISTS public.modifiers;
DROP TABLE IF EXISTS public.mfa_codes;
DROP SEQUENCE IF EXISTS public.inventory_sync_logs_id_seq;
DROP TABLE IF EXISTS public.inventory_sync_logs;
DROP SEQUENCE IF EXISTS public.inventory_id_seq;
DROP TABLE IF EXISTS public.inventory;
DROP SEQUENCE IF EXISTS public.head_offices_id_seq;
DROP TABLE IF EXISTS public.head_offices;
DROP SEQUENCE IF EXISTS public.global_products_id_seq;
DROP TABLE IF EXISTS public.global_products;
DROP SEQUENCE IF EXISTS public.employee_credentials_id_seq;
DROP TABLE IF EXISTS public.employee_credentials;
DROP SEQUENCE IF EXISTS public.categories_id_seq;
DROP TABLE IF EXISTS public.categories;
DROP SEQUENCE IF EXISTS public.budgets_id_seq;
DROP TABLE IF EXISTS public.budgets;
DROP SEQUENCE IF EXISTS public.branches_id_seq;
DROP TABLE IF EXISTS public.branches;
DROP SEQUENCE IF EXISTS public.branch_products_id_seq;
DROP TABLE IF EXISTS public.branch_products;
DROP SEQUENCE IF EXISTS public.branch_inventory_id_seq;
DROP TABLE IF EXISTS public.branch_inventory;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
DROP SEQUENCE IF EXISTS drizzle.__drizzle_migrations_id_seq;
DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
DROP SCHEMA IF EXISTS drizzle;
--
-- TOC entry 6 (class 2615 OID 81974)
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 202 (class 1259 OID 81977)
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- TOC entry 201 (class 1259 OID 81975)
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3664 (class 0 OID 0)
-- Dependencies: 201
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- TOC entry 204 (class 1259 OID 126316)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id uuid,
    organization_id integer,
    branch_id integer,
    action character varying(128) NOT NULL,
    entity character varying(128) NOT NULL,
    entity_id character varying(128),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 203 (class 1259 OID 126314)
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3665 (class 0 OID 0)
-- Dependencies: 203
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- TOC entry 206 (class 1259 OID 126328)
-- Name: branch_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_inventory (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    organization_id integer NOT NULL,
    organization_inventory_id integer NOT NULL,
    assigned_by_user_id uuid NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- TOC entry 205 (class 1259 OID 126326)
-- Name: branch_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3666 (class 0 OID 0)
-- Dependencies: 205
-- Name: branch_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_inventory_id_seq OWNED BY public.branch_inventory.id;


--
-- TOC entry 208 (class 1259 OID 126342)
-- Name: branch_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_products (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    organization_id integer NOT NULL,
    global_product_id integer NOT NULL,
    organization_product_id integer,
    is_visible boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    custom_notes text,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 207 (class 1259 OID 126340)
-- Name: branch_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3667 (class 0 OID 0)
-- Dependencies: 207
-- Name: branch_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_products_id_seq OWNED BY public.branch_products.id;


--
-- TOC entry 210 (class 1259 OID 126362)
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name character varying(255) NOT NULL,
    admin_user_id uuid,
    code character varying(64),
    status character varying(32) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 209 (class 1259 OID 126360)
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3668 (class 0 OID 0)
-- Dependencies: 209
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- TOC entry 212 (class 1259 OID 126373)
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    branch_id integer NOT NULL,
    period character varying(16) NOT NULL,
    amount_allocated_cents integer DEFAULT 0 NOT NULL,
    amount_spent_cents integer DEFAULT 0 NOT NULL,
    amount_held_cents integer DEFAULT 0 NOT NULL,
    amount_credited_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 211 (class 1259 OID 126371)
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3669 (class 0 OID 0)
-- Dependencies: 211
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- TOC entry 214 (class 1259 OID 126387)
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    parent_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 213 (class 1259 OID 126385)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3670 (class 0 OID 0)
-- Dependencies: 213
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 216 (class 1259 OID 126397)
-- Name: employee_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_credentials (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    organization_id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(128),
    last_name character varying(128),
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deactivated_at timestamp with time zone
);


--
-- TOC entry 215 (class 1259 OID 126395)
-- Name: employee_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3671 (class 0 OID 0)
-- Dependencies: 215
-- Name: employee_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_credentials_id_seq OWNED BY public.employee_credentials.id;


--
-- TOC entry 218 (class 1259 OID 126412)
-- Name: global_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_products (
    id integer NOT NULL,
    product_code character varying(128) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category_id integer,
    image_url character varying(512),
    base_price_cents integer DEFAULT 0 NOT NULL,
    unit character varying(64) DEFAULT 'unit'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_synced_at timestamp with time zone,
    discount_type text,
    discount_value_cents integer,
    discount_start_at timestamp with time zone,
    discount_end_at timestamp with time zone,
    discount_active boolean DEFAULT false,
    stock_quantity integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 217 (class 1259 OID 126410)
-- Name: global_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3672 (class 0 OID 0)
-- Dependencies: 217
-- Name: global_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_products_id_seq OWNED BY public.global_products.id;


--
-- TOC entry 220 (class 1259 OID 126429)
-- Name: head_offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.head_offices (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name character varying(255) NOT NULL,
    contact_email character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 219 (class 1259 OID 126427)
-- Name: head_offices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.head_offices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3673 (class 0 OID 0)
-- Dependencies: 219
-- Name: head_offices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.head_offices_id_seq OWNED BY public.head_offices.id;


--
-- TOC entry 222 (class 1259 OID 126441)
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    organization_id integer,
    branch_id integer NOT NULL,
    sku_id integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 221 (class 1259 OID 126439)
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3674 (class 0 OID 0)
-- Dependencies: 221
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- TOC entry 224 (class 1259 OID 126453)
-- Name: inventory_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_sync_logs (
    id integer NOT NULL,
    sync_type character varying(64) NOT NULL,
    trigger_level character varying(32) NOT NULL,
    target_type character varying(32) NOT NULL,
    target_id integer,
    affected_products jsonb DEFAULT '[]'::jsonb,
    changes_count integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    performed_by_user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- TOC entry 223 (class 1259 OID 126451)
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3675 (class 0 OID 0)
-- Dependencies: 223
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_sync_logs_id_seq OWNED BY public.inventory_sync_logs.id;


--
-- TOC entry 225 (class 1259 OID 126467)
-- Name: mfa_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfa_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code character varying(6) NOT NULL,
    type character varying(20) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 227 (class 1259 OID 126478)
-- Name: modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modifiers (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(64) DEFAULT 'unit'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 226 (class 1259 OID 126476)
-- Name: modifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3676 (class 0 OID 0)
-- Dependencies: 226
-- Name: modifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modifiers_id_seq OWNED BY public.modifiers.id;


--
-- TOC entry 229 (class 1259 OID 126493)
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    organization_id integer,
    branch_id integer,
    type character varying(64) NOT NULL,
    target_role character varying(64),
    message text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 228 (class 1259 OID 126491)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3677 (class 0 OID 0)
-- Dependencies: 228
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 231 (class 1259 OID 126505)
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    organization_id integer,
    order_id integer NOT NULL,
    global_product_id integer NOT NULL,
    product_name character varying(255) NOT NULL,
    product_code character varying(128),
    unit character varying(64) NOT NULL,
    quantity integer NOT NULL,
    price_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 230 (class 1259 OID 126503)
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3678 (class 0 OID 0)
-- Dependencies: 230
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- TOC entry 233 (class 1259 OID 126514)
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    tid character varying(26) NOT NULL,
    organization_id integer,
    branch_id integer NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    tax_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    notes text,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 232 (class 1259 OID 126512)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3679 (class 0 OID 0)
-- Dependencies: 232
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 235 (class 1259 OID 126533)
-- Name: org_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_metrics (
    id integer NOT NULL,
    organization_id integer,
    month character varying(16),
    total_orders integer,
    total_spend_cents integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 234 (class 1259 OID 126531)
-- Name: org_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.org_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3680 (class 0 OID 0)
-- Dependencies: 234
-- Name: org_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.org_metrics_id_seq OWNED BY public.org_metrics.id;


--
-- TOC entry 237 (class 1259 OID 126542)
-- Name: organization_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_inventory (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    global_product_id integer NOT NULL,
    assigned_by_user_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    custom_name character varying(255),
    custom_price_cents integer,
    custom_description text,
    custom_image_url character varying(512),
    assigned_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- TOC entry 236 (class 1259 OID 126540)
-- Name: organization_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3681 (class 0 OID 0)
-- Dependencies: 236
-- Name: organization_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_inventory_id_seq OWNED BY public.organization_inventory.id;


--
-- TOC entry 239 (class 1259 OID 126556)
-- Name: organization_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_products (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    global_product_id integer NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    custom_name character varying(255),
    custom_description text,
    custom_price_cents integer,
    custom_image_url character varying(512),
    tags jsonb DEFAULT '[]'::jsonb,
    priority integer DEFAULT 0,
    override_level character varying(32) DEFAULT 'super_admin'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 238 (class 1259 OID 126554)
-- Name: organization_products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3682 (class 0 OID 0)
-- Dependencies: 238
-- Name: organization_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_products_id_seq OWNED BY public.organization_products.id;


--
-- TOC entry 241 (class 1259 OID 126574)
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    key character varying(128) NOT NULL,
    value jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 240 (class 1259 OID 126572)
-- Name: organization_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3683 (class 0 OID 0)
-- Dependencies: 240
-- Name: organization_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_settings_id_seq OWNED BY public.organization_settings.id;


--
-- TOC entry 243 (class 1259 OID 126586)
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(64),
    status character varying(32) DEFAULT 'active'::character varying,
    logo_url character varying(512),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 242 (class 1259 OID 126584)
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3684 (class 0 OID 0)
-- Dependencies: 242
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- TOC entry 245 (class 1259 OID 126600)
-- Name: product_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_assignments (
    id integer NOT NULL,
    global_product_id integer NOT NULL,
    assigned_to_type character varying(32) NOT NULL,
    assigned_to_id integer NOT NULL,
    action character varying(32) NOT NULL,
    performed_by_user_id uuid NOT NULL,
    performed_by_role character varying(64) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 244 (class 1259 OID 126598)
-- Name: product_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3685 (class 0 OID 0)
-- Dependencies: 244
-- Name: product_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_assignments_id_seq OWNED BY public.product_assignments.id;


--
-- TOC entry 247 (class 1259 OID 126613)
-- Name: product_import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_import_batches (
    id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    uploaded_by_user_id uuid NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    successful_rows integer DEFAULT 0 NOT NULL,
    failed_rows integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'processing'::character varying NOT NULL,
    validation_errors jsonb DEFAULT '[]'::jsonb,
    imported_product_ids jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- TOC entry 246 (class 1259 OID 126611)
-- Name: product_import_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_import_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3686 (class 0 OID 0)
-- Dependencies: 246
-- Name: product_import_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_import_batches_id_seq OWNED BY public.product_import_batches.id;


--
-- TOC entry 249 (class 1259 OID 126632)
-- Name: product_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_modifiers (
    id integer NOT NULL,
    product_id integer NOT NULL,
    modifier_id integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 248 (class 1259 OID 126630)
-- Name: product_modifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_modifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3687 (class 0 OID 0)
-- Dependencies: 248
-- Name: product_modifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_modifiers_id_seq OWNED BY public.product_modifiers.id;


--
-- TOC entry 251 (class 1259 OID 126643)
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    category_id integer NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 250 (class 1259 OID 126641)
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3688 (class 0 OID 0)
-- Dependencies: 250
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 253 (class 1259 OID 126656)
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id integer NOT NULL,
    organization_id integer,
    order_id integer NOT NULL,
    amount_cents integer NOT NULL,
    reason character varying(255),
    processed_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(16) DEFAULT 'PENDING'::character varying NOT NULL,
    requested_by_user_id uuid
);


--
-- TOC entry 252 (class 1259 OID 126654)
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3689 (class 0 OID 0)
-- Dependencies: 252
-- Name: refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;


--
-- TOC entry 255 (class 1259 OID 126666)
-- Name: restock_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restock_requests (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    organization_id integer NOT NULL,
    global_product_id integer NOT NULL,
    requested_quantity integer NOT NULL,
    current_stock integer NOT NULL,
    reason text,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    requested_by_user_id uuid NOT NULL,
    reviewed_by_user_id uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 254 (class 1259 OID 126664)
-- Name: restock_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restock_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3690 (class 0 OID 0)
-- Dependencies: 254
-- Name: restock_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restock_requests_id_seq OWNED BY public.restock_requests.id;


--
-- TOC entry 257 (class 1259 OID 126680)
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_key character varying(128) NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 256 (class 1259 OID 126678)
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3691 (class 0 OID 0)
-- Dependencies: 256
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- TOC entry 259 (class 1259 OID 126690)
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(64) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 258 (class 1259 OID 126688)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3692 (class 0 OID 0)
-- Dependencies: 258
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 260 (class 1259 OID 126702)
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id integer,
    refresh_token_hash character varying(255) NOT NULL,
    ip_address character varying(64),
    user_agent character varying(255),
    last_activity_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 262 (class 1259 OID 126715)
-- Name: skus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skus (
    id integer NOT NULL,
    organization_id integer,
    product_id integer NOT NULL,
    sku character varying(128) NOT NULL,
    unit character varying(64) NOT NULL,
    price_cents integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 261 (class 1259 OID 126713)
-- Name: skus_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.skus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3693 (class 0 OID 0)
-- Dependencies: 261
-- Name: skus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.skus_id_seq OWNED BY public.skus.id;


--
-- TOC entry 264 (class 1259 OID 126726)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    contact character varying(255),
    email character varying(255),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 263 (class 1259 OID 126724)
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3694 (class 0 OID 0)
-- Dependencies: 263
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- TOC entry 265 (class 1259 OID 126737)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    full_name character varying(255),
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(32),
    mfa_enabled boolean DEFAULT false NOT NULL,
    organization_id integer,
    branch_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 3065 (class 2604 OID 81980)
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- TOC entry 3066 (class 2604 OID 126319)
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- TOC entry 3068 (class 2604 OID 126331)
-- Name: branch_inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory ALTER COLUMN id SET DEFAULT nextval('public.branch_inventory_id_seq'::regclass);


--
-- TOC entry 3073 (class 2604 OID 126345)
-- Name: branch_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products ALTER COLUMN id SET DEFAULT nextval('public.branch_products_id_seq'::regclass);


--
-- TOC entry 3079 (class 2604 OID 126365)
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- TOC entry 3083 (class 2604 OID 126376)
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- TOC entry 3090 (class 2604 OID 126390)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 3093 (class 2604 OID 126400)
-- Name: employee_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials ALTER COLUMN id SET DEFAULT nextval('public.employee_credentials_id_seq'::regclass);


--
-- TOC entry 3100 (class 2604 OID 126415)
-- Name: global_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_products ALTER COLUMN id SET DEFAULT nextval('public.global_products_id_seq'::regclass);


--
-- TOC entry 3107 (class 2604 OID 126432)
-- Name: head_offices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_offices ALTER COLUMN id SET DEFAULT nextval('public.head_offices_id_seq'::regclass);


--
-- TOC entry 3109 (class 2604 OID 126444)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 3111 (class 2604 OID 126456)
-- Name: inventory_sync_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.inventory_sync_logs_id_seq'::regclass);


--
-- TOC entry 3121 (class 2604 OID 126481)
-- Name: modifiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers ALTER COLUMN id SET DEFAULT nextval('public.modifiers_id_seq'::regclass);


--
-- TOC entry 3126 (class 2604 OID 126496)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3128 (class 2604 OID 126508)
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- TOC entry 3130 (class 2604 OID 126517)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 3137 (class 2604 OID 126536)
-- Name: org_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_metrics ALTER COLUMN id SET DEFAULT nextval('public.org_metrics_id_seq'::regclass);


--
-- TOC entry 3139 (class 2604 OID 126545)
-- Name: organization_inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_inventory ALTER COLUMN id SET DEFAULT nextval('public.organization_inventory_id_seq'::regclass);


--
-- TOC entry 3143 (class 2604 OID 126559)
-- Name: organization_products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_products ALTER COLUMN id SET DEFAULT nextval('public.organization_products_id_seq'::regclass);


--
-- TOC entry 3151 (class 2604 OID 126577)
-- Name: organization_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings ALTER COLUMN id SET DEFAULT nextval('public.organization_settings_id_seq'::regclass);


--
-- TOC entry 3153 (class 2604 OID 126589)
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- TOC entry 3157 (class 2604 OID 126603)
-- Name: product_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_assignments ALTER COLUMN id SET DEFAULT nextval('public.product_assignments_id_seq'::regclass);


--
-- TOC entry 3160 (class 2604 OID 126616)
-- Name: product_import_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_import_batches ALTER COLUMN id SET DEFAULT nextval('public.product_import_batches_id_seq'::regclass);


--
-- TOC entry 3169 (class 2604 OID 126635)
-- Name: product_modifiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_modifiers ALTER COLUMN id SET DEFAULT nextval('public.product_modifiers_id_seq'::regclass);


--
-- TOC entry 3173 (class 2604 OID 126646)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 3177 (class 2604 OID 126659)
-- Name: refunds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);


--
-- TOC entry 3180 (class 2604 OID 126669)
-- Name: restock_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests ALTER COLUMN id SET DEFAULT nextval('public.restock_requests_id_seq'::regclass);


--
-- TOC entry 3184 (class 2604 OID 126683)
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- TOC entry 3187 (class 2604 OID 126693)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 3194 (class 2604 OID 126718)
-- Name: skus id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus ALTER COLUMN id SET DEFAULT nextval('public.skus_id_seq'::regclass);


--
-- TOC entry 3198 (class 2604 OID 126729)
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- TOC entry 3595 (class 0 OID 81977)
-- Dependencies: 202
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	f76d3f01b14bf98558d3098dad7991de83477df76b0312a86815e17e998d75a7	1760017185669
2	0769109977927939af15393a4cbdfc6acff2e83c7d72bfcbfcb58e31f14b8e02	1760111239794
3	cfdb2019fd7144192c991c2f1aa992fda18414e5afa5b107b825d13d445342f7	1760352255022
4	c1a30a1b3208b283b9eef7ceb27c33cf08fe57ed43a861a8e035816060669455	1760368110444
5	79e5589020229d8b4159928eb337dfb898cf8f1d1a984947ae2490a973961ddc	1760437045140
6	6a364e817676b2c2d3dab6c3f916bc2eab6568782bdf13fe9360dc8d8fcd60c1	1760438592736
7	7fe86d1be608675ddeddb746a8276f0672179ebedd75ace917203ce57aa064bb	1760441296426
8	777c8e84b5d8c342f480704b08ec36c4367b0f2856fce76615f3c3523ac55525	1760617246267
9	8a5726849535b7c60828b376dc3cf020dbcce4aab930496771ad982165fea45d	1761307030941
10	c677d018db27eae0138cf011ed79f66e99f945e78288ee5ecd2e8037bda5eca6	1761318724908
11	667043ecad9e7ee8870c5dc47b268415ed7e908d027823faae4ec78ae7dff4af	1764680439150
\.


--
-- TOC entry 3597 (class 0 OID 126316)
-- Dependencies: 204
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, user_id, organization_id, branch_id, action, entity, entity_id, metadata, created_at) FROM stdin;
1	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	CREATE_BUDGET_ALLOCATION	BUDGET	1	{"amount": 50, "period": "2025-11", "branchName": "Malir Halt Branch"}	2025-11-17 17:29:28.847039+05
2	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	GlobalProduct	1	{"name": "Olpers Milk", "basePrice": 500, "productCode": "PRD-002"}	2025-11-20 16:29:16.153512+05
3	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	1	{"productIds": [1], "skippedCount": 0, "assignedCount": 1, "organizationId": "1"}	2025-11-20 16:48:14.566286+05
4	218b4708-26b1-4a86-a6b3-b5483398eb42	\N	\N	CREATE	BranchAssignment	1	{"branchIds": [1], "skippedCount": 0, "assignedCount": 1, "organizationId": 1, "organizationInventoryIds": [1]}	2025-11-20 17:33:29.996456+05
5	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 500, "oldAmount": 50, "branchName": "Malir Halt Branch"}	2025-11-20 17:34:21.661527+05
6	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 500, "oldAmount": 500, "branchName": "Malir Halt Branch"}	2025-11-20 17:34:33.897442+05
7	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	CREATE_BUDGET_ALLOCATION	BUDGET	2	{"amount": 500, "period": "2025-11", "branchName": "Gulberg Branch"}	2025-11-20 17:34:34.247628+05
8	b3464267-3953-4f90-8e0a-503e8ec61f80	1	\N	CREATE_EMPLOYEE_CREDENTIAL	EMPLOYEE_CREDENTIAL	1	{"email": "johndoe@example.com", "branchId": 1}	2025-11-20 18:20:47.400306+05
9	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	CREATE_ORDER	Order	1	{"tid": "mi7hbpnlit8ie1ts", "items": 1, "total": 50000}	2025-11-20 18:40:55.334907+05
10	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	2	{"productIds": [1], "skippedCount": 0, "assignedCount": 1, "organizationId": "2"}	2025-11-20 18:42:40.630196+05
11	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	GlobalProduct	2	{"name": "Tang", "basePrice": 200, "productCode": "PRD-001"}	2025-11-20 18:45:13.033855+05
12	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	3	{"productIds": [2], "skippedCount": 0, "assignedCount": 1, "organizationId": "1"}	2025-11-20 18:45:43.018148+05
13	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	UPDATE	Order	1	{"tid": "mi7hbpnlit8ie1ts", "action": "approve"}	2025-11-20 18:49:11.093367+05
14	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	1	{"tid": "mi7hbpnlit8ie1ts", "action": "approve"}	2025-11-20 18:50:19.364507+05
15	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	1	{"tid": "mi7hbpnlit8ie1ts", "action": "fulfill"}	2025-11-20 18:50:21.732032+05
16	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 100, "oldAmount": 500, "branchName": "Malir Halt Branch"}	2025-11-20 18:51:31.317499+05
17	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 6000, "oldAmount": 100, "branchName": "Malir Halt Branch"}	2025-11-20 18:51:43.714249+05
18	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "unit", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "basePrice": 20000, "updatedAt": "2025-11-20T14:12:00.350Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-11-20 19:12:00.357074+05
19	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "basePrice": 20000, "updatedAt": "2025-11-20T14:12:12.677Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-11-20 19:12:12.681259+05
20	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	CREATE_ORDER	Order	2	{"tid": "mi7it9uiym6rnzul", "items": 1, "total": 50000}	2025-11-20 19:22:34.268003+05
21	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	UPDATE	Order	2	{"tid": "mi7it9uiym6rnzul", "action": "approve"}	2025-11-20 19:23:06.396885+05
22	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	2	{"tid": "mi7it9uiym6rnzul", "action": "approve"}	2025-11-20 19:23:55.064205+05
23	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	4,5	{"productIds": [2, 1], "skippedCount": 0, "assignedCount": 2, "organizationId": "3"}	2025-11-20 19:24:52.352621+05
24	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE_BUDGET_ALLOCATION	BUDGET	3	{"amount": 500, "period": "2025-11", "branchName": "Malir Halt Branch"}	2025-11-20 19:27:35.429748+05
25	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 4000, "oldAmount": 6000, "branchName": "Malir Halt Branch"}	2025-11-24 18:17:44.493897+05
26	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	REFUND	Order	1	{"tid": "mi7hbpnlit8ie1ts", "reason": "Don't Like the Product and returning it", "amountCents": 50000}	2025-12-01 20:09:04.764533+05
27	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	2	{"tid": "mi7it9uiym6rnzul", "action": "fulfill"}	2025-12-01 20:21:59.217612+05
28	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	REFUND_REQUESTED	Order	2	{"tid": "mi7it9uiym6rnzul", "reason": null, "amountCents": 50000}	2025-12-01 20:28:04.227696+05
29	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	REFUND_APPROVED	Order	2	{"tid": "mi7it9uiym6rnzul", "reason": null, "amountCents": 50000}	2025-12-01 20:28:59.398344+05
30	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 20000, "updatedAt": "2025-12-02T13:03:10.431Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-12-02 18:03:10.447459+05
31	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	1	{"name": "Olpers Milk", "unit": "ltr", "status": "active", "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHHvWtqG9OMjF08ITxD3_bY3IopURhJN6YTw&s", "metadata": {}, "basePrice": 50000, "updatedAt": "2025-12-02T13:08:25.959Z", "categoryId": 1, "description": "", "productCode": "PRD-002", "discountType": "percent", "discountEndAt": null, "discountValue": 10, "discountActive": true, "discountStartAt": null}	2025-12-02 18:08:25.972283+05
32	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "metadata": {}, "basePrice": 20000, "updatedAt": "2025-12-02T13:12:31.885Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-12-02 18:12:31.898009+05
33	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 20000, "updatedAt": "2025-12-02T13:15:44.343Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-12-02 18:15:44.351625+05
63	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	14,15,16	{"productIds": [3, 2, 1], "skippedCount": 0, "assignedCount": 3, "organizationId": "4"}	2025-12-06 18:12:07.105038+05
34	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 20000, "updatedAt": "2025-12-02T13:18:37.153Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "discountActive": false, "discountStartAt": null}	2025-12-02 18:18:37.164432+05
35	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	3	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T14:25:22.822Z", "customName": "Tang", "customPrice": 20000, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 19:25:22.837426+05
36	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	3	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T14:25:32.930Z", "customName": "Tang", "customPrice": 30000, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 19:25:32.939724+05
37	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	GlobalProduct	3	{"name": "ABC Juice ", "basePrice": 40, "productCode": "PRD-004"}	2025-12-02 19:33:39.18549+05
38	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	6	{"productIds": [3], "skippedCount": 0, "assignedCount": 1, "organizationId": "1"}	2025-12-02 19:43:17.516488+05
39	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	6	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T14:57:35.291Z", "customName": null, "customPrice": null, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 19:57:35.307051+05
40	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	6	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T14:59:11.122Z", "customName": null, "customPrice": null, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 19:59:11.133568+05
41	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	6	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T15:04:12.565Z", "customName": null, "customPrice": null, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 20:04:12.574053+05
42	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	OrganizationAssignment	6	{"updateData": {"isActive": true, "updatedAt": "2025-12-02T15:07:51.087Z", "customName": null, "customPrice": null, "customImageUrl": null, "customDescription": null}, "performedByRole": "SUPER_ADMIN"}	2025-12-02 20:07:51.09736+05
43	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	DELETE	OrganizationAssignment	bulk	{"productId": null, "deletedCount": 1, "organizationId": null, "branchDeletions": 0, "affectedBranches": []}	2025-12-02 20:19:18.381262+05
44	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	12	{"productIds": [3], "skippedCount": 0, "assignedCount": 1, "organizationId": "1"}	2025-12-02 20:37:32.25635+05
45	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	DELETE	OrganizationAssignment	bulk	{"productId": null, "deletedCount": 1, "organizationId": null, "branchDeletions": 0, "affectedBranches": []}	2025-12-02 20:37:45.457365+05
46	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE	OrganizationAssignment	13	{"productIds": [3], "skippedCount": 0, "assignedCount": 1, "organizationId": "1"}	2025-12-02 20:38:05.419777+05
47	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 5000, "oldAmount": 500, "branchName": "Gulberg Branch"}	2025-12-05 21:46:24.169238+05
48	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 5000, "oldAmount": 4000, "branchName": "Malir Halt Branch"}	2025-12-05 21:46:25.220955+05
49	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 5000, "oldAmount": 5000, "branchName": "Gulberg Branch"}	2025-12-05 21:47:39.745477+05
50	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 2000, "oldAmount": 5000, "branchName": "Gulberg Branch"}	2025-12-05 21:48:57.392621+05
51	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	CREATE_BUDGET_ALLOCATION	BUDGET	2	{"amount": 5000, "period": "2025-12", "branchName": "Gulberg Branch"}	2025-12-05 22:25:45.956331+05
52	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 5000, "oldAmount": 5000, "branchName": "Gulberg Branch"}	2025-12-05 22:26:01.456868+05
53	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	CREATE_BUDGET_ALLOCATION	BUDGET	1	{"amount": 5000, "period": "2025-12", "branchName": "Malir Halt Branch"}	2025-12-05 22:26:01.713782+05
54	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 6000, "oldAmount": 5000, "branchName": "Gulberg Branch"}	2025-12-05 22:26:11.436065+05
55	218b4708-26b1-4a86-a6b3-b5483398eb42	1	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 6000, "oldAmount": 5000, "branchName": "Malir Halt Branch"}	2025-12-05 22:26:11.632181+05
56	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	3	{"name": "ABC Juice ", "unit": "unit", "status": "active", "imageUrl": "https://media.naheed.pk/catalog/product/cache/2f2d0cb0c5f92580479e8350be94f387/1/2/1240061-1.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 4000, "updatedAt": "2025-12-06T00:19:42.449Z", "categoryId": 2, "description": "", "productCode": "PRD-004", "discountType": null, "discountEndAt": null, "discountValue": null, "stockQuantity": 5, "discountActive": false, "discountStartAt": null}	2025-12-06 05:19:42.48006+05
57	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	2	{"name": "Tang", "unit": "box", "status": "active", "imageUrl": "/uploads/products/product_1763646296533_l9v5s4jjog.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 20000, "updatedAt": "2025-12-06T00:20:06.117Z", "categoryId": 2, "description": "", "productCode": "PRD-001", "discountType": null, "discountEndAt": null, "discountValue": null, "stockQuantity": 50, "discountActive": false, "discountStartAt": null}	2025-12-06 05:20:06.127029+05
58	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	1	{"name": "Olpers Milk", "unit": "ltr", "status": "active", "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHHvWtqG9OMjF08ITxD3_bY3IopURhJN6YTw&s", "metadata": {}, "basePrice": 50000, "updatedAt": "2025-12-06T00:20:27.478Z", "categoryId": 1, "description": "", "productCode": "PRD-002", "discountType": "percent", "discountEndAt": null, "discountValue": 10, "stockQuantity": 70, "discountActive": true, "discountStartAt": null}	2025-12-06 05:20:27.489341+05
59	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	3	{"tid": "mitjsplamqtvlcfn", "items": 2, "total": 54000}	2025-12-06 05:21:03.504726+05
60	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	UPDATE	Order	3	{"tid": "mitjsplamqtvlcfn", "action": "approve"}	2025-12-06 05:22:00.814898+05
61	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	3	{"tid": "mitjsplamqtvlcfn", "action": "fulfill"}	2025-12-06 05:22:34.553074+05
62	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE	GlobalProduct	3	{"name": "ABC Juice ", "unit": "unit", "status": "active", "imageUrl": "https://media.naheed.pk/catalog/product/cache/2f2d0cb0c5f92580479e8350be94f387/1/2/1240061-1.jpg", "metadata": {"subCategoryId": 3}, "basePrice": 4000, "updatedAt": "2025-12-06T13:10:04.042Z", "categoryId": 2, "description": "", "productCode": "PRD-004", "discountType": null, "discountEndAt": null, "discountValue": null, "stockQuantity": 20, "discountActive": false, "discountStartAt": null}	2025-12-06 18:10:04.065111+05
64	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE_BUDGET_ALLOCATION	BUDGET	5	{"amount": 5000, "period": "2025-12", "branchName": "Sharah-e faisal Branch"}	2025-12-06 18:13:11.08302+05
65	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	5	{"newAmount": 4500, "oldAmount": 5000, "branchName": "Sharah-e faisal Branch"}	2025-12-06 18:13:29.722185+05
66	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	4	{"tid": "miubmcz5chzklkl1", "items": 2, "total": 154000}	2025-12-06 18:19:56.470797+05
67	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	UPDATE	Order	4	{"tid": "miubmcz5chzklkl1", "action": "approve"}	2025-12-06 18:20:33.102995+05
68	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	4	{"tid": "miubmcz5chzklkl1", "action": "fulfill"}	2025-12-06 18:21:23.079766+05
69	f81b18b1-0aa7-4614-9206-fe4afa81f061	4	5	CREATE_ORDER	Order	5	{"tid": "miubpgx2wcar3u8l", "items": 2, "total": 93000}	2025-12-06 18:22:21.543473+05
70	f81b18b1-0aa7-4614-9206-fe4afa81f061	4	5	UPDATE	Order	5	{"tid": "miubpgx2wcar3u8l", "action": "approve"}	2025-12-06 18:22:49.390106+05
71	f81b18b1-0aa7-4614-9206-fe4afa81f061	4	5	UPDATE	Order	5	{"tid": "miubpgx2wcar3u8l", "action": "fulfill"}	2025-12-06 18:22:53.265156+05
72	218b4708-26b1-4a86-a6b3-b5483398eb42	1	1	REFUND_REQUESTED	Order	4	{"tid": "miubmcz5chzklkl1", "reason": "Product was expired", "amountCents": 150000}	2025-12-06 18:24:31.96027+05
73	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	REFUND_APPROVED	Order	4	{"tid": "miubmcz5chzklkl1", "reason": null, "amountCents": 150000}	2025-12-06 18:25:34.903114+05
\.


--
-- TOC entry 3599 (class 0 OID 126328)
-- Dependencies: 206
-- Data for Name: branch_inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branch_inventory (id, branch_id, organization_id, organization_inventory_id, assigned_by_user_id, is_visible, is_active, assigned_at, updated_at, deleted_at) FROM stdin;
1	1	1	1	218b4708-26b1-4a86-a6b3-b5483398eb42	t	t	2025-11-20 17:33:29.985198+05	2025-11-20 17:33:29.985198+05	\N
\.


--
-- TOC entry 3601 (class 0 OID 126342)
-- Dependencies: 208
-- Data for Name: branch_products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branch_products (id, branch_id, organization_id, global_product_id, organization_product_id, is_visible, is_available, custom_notes, metadata, updated_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3603 (class 0 OID 126362)
-- Dependencies: 210
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branches (id, organization_id, name, admin_user_id, code, status, created_at, updated_at) FROM stdin;
2	1	Gulberg Branch	\N	9912	active	2025-10-24 19:27:12.012185+05	2025-10-24 19:27:12.012185+05
3	2	Malir Halt Branch	\N	9913	active	2025-11-20 17:39:38.276003+05	2025-11-20 17:39:38.276003+05
4	3	ABC Branch	\N	8816	active	2025-11-20 19:03:34.975928+05	2025-11-20 19:03:34.975928+05
1	1	Malir Halt Branch	\N	9913	active	2025-10-24 19:26:57.36177+05	2025-10-24 19:26:57.36177+05
5	4	Sharah-e faisal Branch	\N	SF-02	active	2025-12-06 17:51:24.803626+05	2025-12-06 17:51:24.803626+05
\.


--
-- TOC entry 3605 (class 0 OID 126373)
-- Dependencies: 212
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budgets (id, organization_id, branch_id, period, amount_allocated_cents, amount_spent_cents, amount_held_cents, amount_credited_cents, created_at, updated_at) FROM stdin;
3	2	3	2025-11	50000	0	0	0	2025-11-20 19:27:35.418812+05	2025-11-20 19:27:35.418812+05
2	1	2	2025-11	200000	0	0	0	2025-11-20 17:34:34.242711+05	2025-12-05 21:48:57.383+05
4	1	2	2025-12	600000	0	0	0	2025-12-05 22:25:45.939942+05	2025-12-05 22:26:11.433+05
5	1	1	2025-12	600000	0	0	0	2025-12-05 22:26:01.708091+05	2025-12-05 22:26:11.629+05
6	4	5	2025-12	450000	93000	0	0	2025-12-06 18:13:11.074897+05	2025-12-06 18:13:29.709+05
1	1	1	2025-11	500000	58000	0	250000	2025-11-17 17:29:28.81067+05	2025-12-05 21:46:25.216+05
\.


--
-- TOC entry 3607 (class 0 OID 126387)
-- Dependencies: 214
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, organization_id, name, parent_id, created_at, updated_at) FROM stdin;
1	\N	Dairy	\N	2025-10-28 16:00:48.167317+05	2025-10-28 16:00:48.167317+05
2	\N	Juice	\N	2025-11-20 18:46:18.729376+05	2025-11-20 19:11:42.767+05
3	\N	Canned	2	2025-12-02 17:35:48.190936+05	2025-12-02 17:36:46.941+05
\.


--
-- TOC entry 3609 (class 0 OID 126397)
-- Dependencies: 216
-- Data for Name: employee_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_credentials (id, branch_id, organization_id, email, password_hash, first_name, last_name, mfa_enabled, mfa_secret, is_active, created_by_user_id, created_at, updated_at, deactivated_at) FROM stdin;
1	1	1	johndoe@example.com	$2b$10$c4berTLBcLfGL5cbYTXZmeAK0H6.Cm2mlYYLQqcIDSDrLkBoOMNVy	John 	Doe	t	\N	t	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-11-20 18:20:47.382068+05	2025-11-20 18:20:47.382068+05	\N
\.


--
-- TOC entry 3611 (class 0 OID 126412)
-- Dependencies: 218
-- Data for Name: global_products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.global_products (id, product_code, name, description, category_id, image_url, base_price_cents, unit, status, metadata, created_by_user_id, created_at, updated_at, last_synced_at, discount_type, discount_value_cents, discount_start_at, discount_end_at, discount_active, stock_quantity) FROM stdin;
2	PRD-001	Tang		2	/uploads/products/product_1763646296533_l9v5s4jjog.jpg	20000	box	active	{"subCategoryId": 3}	\N	2025-11-20 18:45:13.02965+05	2025-12-06 05:20:06.117+05	\N	\N	\N	\N	\N	f	50
3	PRD-004	ABC Juice 		2	https://media.naheed.pk/catalog/product/cache/2f2d0cb0c5f92580479e8350be94f387/1/2/1240061-1.jpg	4000	unit	active	{"subCategoryId": 3}	\N	2025-12-02 19:33:39.174849+05	2025-12-06 18:22:21.603+05	\N	\N	\N	\N	\N	f	18
1	PRD-002	Olpers Milk		1	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHHvWtqG9OMjF08ITxD3_bY3IopURhJN6YTw&s	50000	ltr	active	{}	\N	2025-11-20 16:29:16.131975+05	2025-12-06 18:22:21.606+05	\N	percent	10	\N	\N	t	64
\.


--
-- TOC entry 3613 (class 0 OID 126429)
-- Dependencies: 220
-- Data for Name: head_offices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.head_offices (id, organization_id, name, contact_email, created_at) FROM stdin;
\.


--
-- TOC entry 3615 (class 0 OID 126441)
-- Dependencies: 222
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory (id, organization_id, branch_id, sku_id, updated_at) FROM stdin;
\.


--
-- TOC entry 3617 (class 0 OID 126453)
-- Dependencies: 224
-- Data for Name: inventory_sync_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory_sync_logs (id, sync_type, trigger_level, target_type, target_id, affected_products, changes_count, status, error_message, performed_by_user_id, started_at, completed_at, metadata) FROM stdin;
\.


--
-- TOC entry 3618 (class 0 OID 126467)
-- Dependencies: 225
-- Data for Name: mfa_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mfa_codes (id, user_id, code, type, expires_at, attempts, is_used, created_at) FROM stdin;
d1bd6d30-04ee-4f5b-968e-3b2cf47bb909	218b4708-26b1-4a86-a6b3-b5483398eb42	185899	LOGIN	2025-11-17 16:08:40.803+05	0	t	2025-11-17 16:06:40.812092+05
66769cfa-afaa-43a9-9e8c-5aa65cdaf8b7	218b4708-26b1-4a86-a6b3-b5483398eb42	886064	LOGIN	2025-11-17 16:11:18.064+05	0	t	2025-11-17 16:09:18.077084+05
ce794bda-8b15-485b-a583-fc1bc2fa1895	218b4708-26b1-4a86-a6b3-b5483398eb42	790794	LOGIN	2025-11-17 17:32:21.904+05	0	t	2025-11-17 17:30:21.907924+05
7bf8cbed-ae81-44b9-83ef-e47d5fda7a4b	b3464267-3953-4f90-8e0a-503e8ec61f80	211326	LOGIN	2025-11-17 17:33:54.275+05	0	t	2025-11-17 17:31:54.432579+05
45f80026-12e0-47b0-aa28-8ae0ee1e1301	218b4708-26b1-4a86-a6b3-b5483398eb42	109945	LOGIN	2025-11-17 17:36:32.665+05	0	f	2025-11-17 17:34:32.667237+05
2ad7fbfd-a670-4b5a-92b6-26bfa01015f5	218b4708-26b1-4a86-a6b3-b5483398eb42	914268	LOGIN	2025-11-17 17:46:41.292+05	0	t	2025-11-17 17:44:41.326611+05
a9b5d759-7513-4ea0-82d2-0a028767e8df	218b4708-26b1-4a86-a6b3-b5483398eb42	300589	LOGIN	2025-11-20 16:41:07.197+05	0	f	2025-11-20 16:39:07.209265+05
b2c5968d-deba-4828-ba7a-780f18420dd7	218b4708-26b1-4a86-a6b3-b5483398eb42	318934	LOGIN	2025-11-20 17:34:29.559+05	0	t	2025-11-20 17:32:29.589078+05
12ec3ccc-bb9d-4e4b-bee7-ffd824455fc5	218b4708-26b1-4a86-a6b3-b5483398eb42	305257	LOGIN	2025-11-20 17:40:08.582+05	0	t	2025-11-20 17:38:08.783944+05
91e01255-cdc4-44ab-b47e-6932ae206f60	218b4708-26b1-4a86-a6b3-b5483398eb42	348926	LOGIN	2025-11-20 17:58:24.074+05	0	f	2025-11-20 17:56:24.076194+05
23e1847d-bfa4-4c32-a68f-5ebe4078c461	218b4708-26b1-4a86-a6b3-b5483398eb42	975275	LOGIN	2025-11-20 17:59:44.625+05	0	f	2025-11-20 17:57:44.627721+05
fc15bc65-ecb5-488a-8cd0-d55a01afb874	218b4708-26b1-4a86-a6b3-b5483398eb42	750657	LOGIN	2025-11-20 17:59:10.986+05	0	t	2025-11-20 17:57:10.987908+05
b056bd8e-ec8a-400f-91e8-19e2a4fde3fa	b3464267-3953-4f90-8e0a-503e8ec61f80	251173	LOGIN	2025-11-20 18:20:52.001+05	0	t	2025-11-20 18:18:52.006743+05
b14ad335-67c9-43f4-ae00-68feb46aba9c	218b4708-26b1-4a86-a6b3-b5483398eb42	992009	LOGIN	2025-11-20 18:58:50.771+05	0	t	2025-11-20 18:56:50.867615+05
5fb9c4f3-cd2d-4f68-8054-8ea0db3bf7ad	b3464267-3953-4f90-8e0a-503e8ec61f80	609116	LOGIN	2025-11-20 19:00:08.248+05	0	f	2025-11-20 18:58:08.25336+05
c07d9915-f874-41f7-b31f-426da5407c94	b3464267-3953-4f90-8e0a-503e8ec61f80	678485	LOGIN	2025-11-20 19:00:37.359+05	0	f	2025-11-20 18:58:39.356511+05
724ef20c-8416-4707-beca-06748e6ee05e	b3464267-3953-4f90-8e0a-503e8ec61f80	580952	LOGIN	2025-11-20 19:01:21.901+05	0	f	2025-11-20 18:59:21.906391+05
19686c5d-6369-4fab-9435-eda55e990a74	b3464267-3953-4f90-8e0a-503e8ec61f80	610598	LOGIN	2025-11-20 19:08:47.845+05	0	t	2025-11-20 19:06:48.211822+05
62744bdd-d536-40c4-ab07-ac51c9aa5140	218b4708-26b1-4a86-a6b3-b5483398eb42	657559	LOGIN	2025-11-24 16:36:11.05+05	0	t	2025-11-24 16:34:11.065682+05
9ac9526e-0b21-433b-89b2-24560b4b7cdd	218b4708-26b1-4a86-a6b3-b5483398eb42	446708	LOGIN	2025-12-01 17:10:52.43+05	0	t	2025-12-01 17:08:52.441348+05
077f710d-4bd3-4aea-a5ce-242bd8294d32	218b4708-26b1-4a86-a6b3-b5483398eb42	169973	LOGIN	2025-12-01 18:18:24.471+05	0	t	2025-12-01 18:16:24.477099+05
955c221a-1be7-4b24-aff9-705de4ef9686	218b4708-26b1-4a86-a6b3-b5483398eb42	122473	LOGIN	2025-12-01 18:22:45.138+05	0	t	2025-12-01 18:20:45.143842+05
7cf9d75a-94f3-4979-9b8b-2cbfd219fd2a	218b4708-26b1-4a86-a6b3-b5483398eb42	978393	LOGIN	2025-12-02 16:32:20.491+05	0	t	2025-12-02 16:30:20.496621+05
c3099880-45d1-40d3-8696-5b795a141fad	218b4708-26b1-4a86-a6b3-b5483398eb42	785079	LOGIN	2025-12-05 21:34:22.793+05	0	t	2025-12-05 21:32:22.800509+05
fdcda932-1c70-4ecb-b299-204cf5388018	b3464267-3953-4f90-8e0a-503e8ec61f80	435454	LOGIN	2025-12-05 21:52:36.712+05	0	t	2025-12-05 21:50:36.727257+05
\.


--
-- TOC entry 3620 (class 0 OID 126478)
-- Dependencies: 227
-- Data for Name: modifiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.modifiers (id, name, description, type, status, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3622 (class 0 OID 126493)
-- Dependencies: 229
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, organization_id, branch_id, type, target_role, message, read_at, created_at) FROM stdin;
\.


--
-- TOC entry 3624 (class 0 OID 126505)
-- Dependencies: 231
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, organization_id, order_id, global_product_id, product_name, product_code, unit, quantity, price_cents, created_at) FROM stdin;
1	1	1	1	Olpers Milk	PRD-002	ltr	1	50000	2025-11-20 18:40:55.334907+05
2	1	2	1	Olpers Milk	PRD-002	ltr	1	50000	2025-11-20 19:22:34.268003+05
3	1	3	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-06 05:21:03.504726+05
4	1	3	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-06 05:21:03.504726+05
5	1	4	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-06 18:19:56.470797+05
6	1	4	1	Olpers Milk	PRD-002	ltr	3	50000	2025-12-06 18:19:56.470797+05
7	4	5	3	ABC Juice 	PRD-004	unit	1	3000	2025-12-06 18:22:21.543473+05
8	4	5	1	Olpers Milk	PRD-002	ltr	2	45000	2025-12-06 18:22:21.543473+05
\.


--
-- TOC entry 3626 (class 0 OID 126514)
-- Dependencies: 233
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, tid, organization_id, branch_id, status, subtotal_cents, tax_cents, total_cents, notes, created_by_user_id, created_at, updated_at) FROM stdin;
1	mi7hbpnlit8ie1ts	1	1	refunded	50000	0	50000	\N	218b4708-26b1-4a86-a6b3-b5483398eb42	2025-11-20 18:40:55.334907+05	2025-11-20 18:40:55.334907+05
2	mi7it9uiym6rnzul	1	1	refunded	50000	0	50000	\N	218b4708-26b1-4a86-a6b3-b5483398eb42	2025-11-20 19:22:34.268003+05	2025-11-20 19:22:34.268003+05
3	mitjsplamqtvlcfn	1	1	fulfilled	54000	0	54000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-06 05:21:03.504726+05	2025-12-06 05:21:03.504726+05
4	miubmcz5chzklkl1	1	1	fulfilled	154000	0	154000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-06 18:19:56.470797+05	2025-12-06 18:19:56.470797+05
5	miubpgx2wcar3u8l	4	5	fulfilled	93000	0	93000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-06 18:22:21.543473+05	2025-12-06 18:22:21.543473+05
\.


--
-- TOC entry 3628 (class 0 OID 126533)
-- Dependencies: 235
-- Data for Name: org_metrics; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.org_metrics (id, organization_id, month, total_orders, total_spend_cents, created_at) FROM stdin;
\.


--
-- TOC entry 3630 (class 0 OID 126542)
-- Dependencies: 237
-- Data for Name: organization_inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_inventory (id, organization_id, global_product_id, assigned_by_user_id, is_active, custom_name, custom_price_cents, custom_description, custom_image_url, assigned_at, updated_at, deleted_at) FROM stdin;
1	1	1	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	Olpers Milk	\N	\N	\N	2025-11-20 16:48:14.524706+05	2025-11-20 16:48:14.524706+05	\N
2	2	1	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	Olpers Milk	40000	\N	\N	2025-11-20 18:42:40.616966+05	2025-11-20 18:42:40.616966+05	\N
4	3	2	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	\N	\N	\N	2025-11-20 19:24:52.346873+05	2025-11-20 19:24:52.346873+05	\N
5	3	1	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	\N	\N	\N	2025-11-20 19:24:52.346873+05	2025-11-20 19:24:52.346873+05	\N
3	1	2	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	Tang	30000	\N	\N	2025-11-20 18:45:43.012075+05	2025-12-02 19:25:32.93+05	\N
13	1	3	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	\N	\N	\N	2025-12-02 20:38:05.41357+05	2025-12-02 20:38:05.41357+05	\N
14	4	3	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	3000	\N	\N	2025-12-06 18:12:07.075029+05	2025-12-06 18:12:07.075029+05	\N
15	4	2	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	15000	\N	\N	2025-12-06 18:12:07.075029+05	2025-12-06 18:12:07.075029+05	\N
16	4	1	f81b18b1-0aa7-4614-9206-fe4afa81f061	t	\N	45000	\N	\N	2025-12-06 18:12:07.075029+05	2025-12-06 18:12:07.075029+05	\N
\.


--
-- TOC entry 3632 (class 0 OID 126556)
-- Dependencies: 239
-- Data for Name: organization_products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_products (id, organization_id, global_product_id, is_enabled, custom_name, custom_description, custom_price_cents, custom_image_url, tags, priority, override_level, metadata, updated_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3634 (class 0 OID 126574)
-- Dependencies: 241
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_settings (id, organization_id, key, value, updated_at) FROM stdin;
1	1	default_currency	"USD"	2025-10-24 19:58:28.628461+05
2	1	tax_rate	0	2025-10-24 19:58:28.637215+05
3	1	auto_approve_orders	false	2025-10-24 19:58:28.640034+05
4	1	order_approval_threshold	10000	2025-10-24 19:58:28.641897+05
5	1	require_mfa	false	2025-10-24 19:58:28.643712+05
6	1	session_timeout_minutes	60	2025-10-24 19:58:28.645591+05
7	1	low_stock_threshold	10	2025-10-24 19:58:28.650543+05
8	1	enable_notifications	true	2025-10-24 19:58:28.654502+05
\.


--
-- TOC entry 3636 (class 0 OID 126586)
-- Dependencies: 243
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, code, status, logo_url, created_at, updated_at) FROM stdin;
1	Meezan Bank	BANK-001	active	\N	2025-10-24 19:26:44.101136+05	2025-10-24 19:26:44.101136+05
2	HBL Bank	BANK-002	active	\N	2025-11-20 17:39:21.734852+05	2025-11-20 17:39:21.734852+05
3	Swenta	CORP-001	active	\N	2025-11-20 19:03:17.370599+05	2025-11-20 19:03:17.370599+05
4	Systems ltd	12187	active	\N	2025-12-06 17:50:40.202806+05	2025-12-06 17:50:40.202806+05
\.


--
-- TOC entry 3638 (class 0 OID 126600)
-- Dependencies: 245
-- Data for Name: product_assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_assignments (id, global_product_id, assigned_to_type, assigned_to_id, action, performed_by_user_id, performed_by_role, metadata, created_at) FROM stdin;
\.


--
-- TOC entry 3640 (class 0 OID 126613)
-- Dependencies: 247
-- Data for Name: product_import_batches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_import_batches (id, file_name, uploaded_by_user_id, total_rows, successful_rows, failed_rows, status, validation_errors, imported_product_ids, metadata, created_at, completed_at) FROM stdin;
\.


--
-- TOC entry 3642 (class 0 OID 126632)
-- Dependencies: 249
-- Data for Name: product_modifiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_modifiers (id, product_id, modifier_id, is_default, sort_order, created_at) FROM stdin;
\.


--
-- TOC entry 3644 (class 0 OID 126643)
-- Dependencies: 251
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, organization_id, name, category_id, description, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3646 (class 0 OID 126656)
-- Dependencies: 253
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refunds (id, organization_id, order_id, amount_cents, reason, processed_by_user_id, created_at, updated_at, status, requested_by_user_id) FROM stdin;
1	1	1	50000	Don't Like the Product and returning it	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-01 20:09:04.764533+05	2025-12-01 20:09:04.764533+05	PENDING	\N
2	1	2	50000	\N	\N	2025-12-01 20:28:04.227696+05	2025-12-01 20:28:04.227696+05	PENDING	b3464267-3953-4f90-8e0a-503e8ec61f80
3	1	2	50000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-01 20:28:59.398344+05	2025-12-01 20:28:59.398344+05	APPROVED	\N
4	1	4	150000	Product was expired	\N	2025-12-06 18:24:31.96027+05	2025-12-06 18:24:31.96027+05	PENDING	218b4708-26b1-4a86-a6b3-b5483398eb42
5	1	4	150000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-06 18:25:34.903114+05	2025-12-06 18:25:34.903114+05	APPROVED	\N
\.


--
-- TOC entry 3648 (class 0 OID 126666)
-- Dependencies: 255
-- Data for Name: restock_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restock_requests (id, branch_id, organization_id, global_product_id, requested_quantity, current_stock, reason, status, requested_by_user_id, reviewed_by_user_id, reviewed_at, review_notes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3650 (class 0 OID 126680)
-- Dependencies: 257
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, role_id, permission_key, allowed, created_at) FROM stdin;
1	1	system:full_access	t	2025-10-24 19:58:28.078254+05
2	1	system:view_audit_logs	t	2025-10-24 19:58:28.078254+05
3	1	system:manage_roles	t	2025-10-24 19:58:28.078254+05
4	1	system:manage_permissions	t	2025-10-24 19:58:28.078254+05
5	1	system:view_health	t	2025-10-24 19:58:28.078254+05
6	1	org:create	t	2025-10-24 19:58:28.078254+05
7	1	org:view	t	2025-10-24 19:58:28.078254+05
8	1	org:edit	t	2025-10-24 19:58:28.078254+05
9	1	org:delete	t	2025-10-24 19:58:28.078254+05
10	1	org:manage_settings	t	2025-10-24 19:58:28.078254+05
11	1	org:manage_branches	t	2025-10-24 19:58:28.078254+05
12	1	org:view_metrics	t	2025-10-24 19:58:28.078254+05
13	1	user:create	t	2025-10-24 19:58:28.078254+05
14	1	user:view	t	2025-10-24 19:58:28.078254+05
15	1	user:edit	t	2025-10-24 19:58:28.078254+05
16	1	user:delete	t	2025-10-24 19:58:28.078254+05
17	1	user:manage_roles	t	2025-10-24 19:58:28.078254+05
18	1	user:reset_password	t	2025-10-24 19:58:28.078254+05
19	1	user:manage_mfa	t	2025-10-24 19:58:28.078254+05
20	1	user:view_sessions	t	2025-10-24 19:58:28.078254+05
21	1	inventory:create	t	2025-10-24 19:58:28.078254+05
22	1	inventory:view	t	2025-10-24 19:58:28.078254+05
23	1	inventory:edit	t	2025-10-24 19:58:28.078254+05
24	1	inventory:delete	t	2025-10-24 19:58:28.078254+05
25	1	inventory:adjust	t	2025-10-24 19:58:28.078254+05
26	1	inventory:transfer	t	2025-10-24 19:58:28.078254+05
27	1	inventory:manage_warehouses	t	2025-10-24 19:58:28.078254+05
28	1	inventory:manage_suppliers	t	2025-10-24 19:58:28.078254+05
29	1	order:create	t	2025-10-24 19:58:28.078254+05
30	1	order:view	t	2025-10-24 19:58:28.078254+05
31	1	order:edit	t	2025-10-24 19:58:28.078254+05
32	1	order:delete	t	2025-10-24 19:58:28.078254+05
33	1	order:approve	t	2025-10-24 19:58:28.078254+05
34	1	order:reject	t	2025-10-24 19:58:28.078254+05
35	1	order:cancel	t	2025-10-24 19:58:28.078254+05
36	1	order:view_all	t	2025-10-24 19:58:28.078254+05
37	1	finance:view_budgets	t	2025-10-24 19:58:28.078254+05
38	1	finance:manage_budgets	t	2025-10-24 19:58:28.078254+05
39	1	finance:view_reports	t	2025-10-24 19:58:28.078254+05
40	1	finance:approve_expenses	t	2025-10-24 19:58:28.078254+05
41	1	reports:view_all	t	2025-10-24 19:58:28.078254+05
42	1	reports:view_organization	t	2025-10-24 19:58:28.078254+05
43	1	reports:view_branch	t	2025-10-24 19:58:28.078254+05
44	1	reports:export	t	2025-10-24 19:58:28.078254+05
45	1	reports:schedule	t	2025-10-24 19:58:28.078254+05
46	1	settings:view	t	2025-10-24 19:58:28.078254+05
47	1	settings:edit	t	2025-10-24 19:58:28.078254+05
48	1	settings:manage_categories	t	2025-10-24 19:58:28.078254+05
49	1	settings:manage_products	t	2025-10-24 19:58:28.078254+05
50	2	org:view	t	2025-10-24 19:58:28.123144+05
51	2	org:edit	t	2025-10-24 19:58:28.123144+05
52	2	org:manage_settings	t	2025-10-24 19:58:28.123144+05
53	2	org:manage_branches	t	2025-10-24 19:58:28.123144+05
54	2	org:view_metrics	t	2025-10-24 19:58:28.123144+05
55	2	user:view	t	2025-10-24 19:58:28.123144+05
56	2	user:create	t	2025-10-24 19:58:28.123144+05
57	2	user:edit	t	2025-10-24 19:58:28.123144+05
58	2	user:manage_roles	t	2025-10-24 19:58:28.123144+05
59	2	inventory:view	t	2025-10-24 19:58:28.123144+05
60	2	order:view	t	2025-10-24 19:58:28.123144+05
61	2	order:approve	t	2025-10-24 19:58:28.123144+05
62	2	order:reject	t	2025-10-24 19:58:28.123144+05
63	2	order:view_all	t	2025-10-24 19:58:28.123144+05
64	2	finance:view_budgets	t	2025-10-24 19:58:28.123144+05
65	2	finance:manage_budgets	t	2025-10-24 19:58:28.123144+05
66	2	finance:view_reports	t	2025-10-24 19:58:28.123144+05
67	2	finance:approve_expenses	t	2025-10-24 19:58:28.123144+05
68	2	reports:view_all	t	2025-10-24 19:58:28.123144+05
69	2	reports:view_organization	t	2025-10-24 19:58:28.123144+05
70	2	reports:export	t	2025-10-24 19:58:28.123144+05
71	2	settings:view	t	2025-10-24 19:58:28.123144+05
72	2	settings:edit	t	2025-10-24 19:58:28.123144+05
73	3	user:view	t	2025-10-24 19:58:28.137412+05
74	3	user:create	t	2025-10-24 19:58:28.137412+05
75	3	inventory:create	t	2025-10-24 19:58:28.137412+05
76	3	inventory:view	t	2025-10-24 19:58:28.137412+05
77	3	inventory:edit	t	2025-10-24 19:58:28.137412+05
78	3	inventory:adjust	t	2025-10-24 19:58:28.137412+05
79	3	inventory:manage_suppliers	t	2025-10-24 19:58:28.137412+05
80	3	order:create	t	2025-10-24 19:58:28.137412+05
81	3	order:view	t	2025-10-24 19:58:28.137412+05
82	3	order:edit	t	2025-10-24 19:58:28.137412+05
83	3	finance:view_budgets	t	2025-10-24 19:58:28.137412+05
84	3	reports:view_branch	t	2025-10-24 19:58:28.137412+05
85	3	reports:export	t	2025-10-24 19:58:28.137412+05
86	3	settings:view	t	2025-10-24 19:58:28.137412+05
\.


--
-- TOC entry 3652 (class 0 OID 126690)
-- Dependencies: 259
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name, description, permissions, created_at, updated_at) FROM stdin;
1	SUPER_ADMIN	Full system access with all permissions	{"org:edit": true, "org:view": true, "user:edit": true, "user:view": true, "order:edit": true, "order:view": true, "org:create": true, "org:delete": true, "user:create": true, "user:delete": true, "order:cancel": true, "order:create": true, "order:delete": true, "order:reject": true, "order:approve": true, "settings:edit": true, "settings:view": true, "inventory:edit": true, "inventory:view": true, "order:view_all": true, "reports:export": true, "user:manage_mfa": true, "inventory:adjust": true, "inventory:create": true, "inventory:delete": true, "org:view_metrics": true, "reports:schedule": true, "reports:view_all": true, "user:manage_roles": true, "inventory:transfer": true, "system:full_access": true, "system:view_health": true, "user:view_sessions": true, "org:manage_branches": true, "org:manage_settings": true, "reports:view_branch": true, "system:manage_roles": true, "user:reset_password": true, "finance:view_budgets": true, "finance:view_reports": true, "finance:manage_budgets": true, "system:view_audit_logs": true, "finance:approve_expenses": true, "settings:manage_products": true, "reports:view_organization": true, "system:manage_permissions": true, "inventory:manage_suppliers": true, "settings:manage_categories": true, "inventory:manage_warehouses": true}	2025-10-24 19:58:27.988249+05	2025-10-24 19:58:28.089+05
2	HEAD_OFFICE	Organization-level management and oversight	{"org:edit": true, "org:view": true, "user:edit": true, "user:view": true, "order:view": true, "user:create": true, "order:reject": true, "order:approve": true, "settings:edit": true, "settings:view": true, "inventory:view": true, "order:view_all": true, "reports:export": true, "org:view_metrics": true, "reports:view_all": true, "user:manage_roles": true, "org:manage_branches": true, "org:manage_settings": true, "finance:view_budgets": true, "finance:view_reports": true, "finance:manage_budgets": true, "finance:approve_expenses": true, "reports:view_organization": true}	2025-10-24 19:58:28.017676+05	2025-10-24 19:58:28.124+05
3	BRANCH_ADMIN	Branch-level operations and management	{"user:view": true, "order:edit": true, "order:view": true, "user:create": true, "order:create": true, "settings:view": true, "inventory:edit": true, "inventory:view": true, "reports:export": true, "inventory:adjust": true, "inventory:create": true, "reports:view_branch": true, "finance:view_budgets": true, "inventory:manage_suppliers": true}	2025-10-24 19:58:28.027107+05	2025-10-24 19:58:28.138+05
\.


--
-- TOC entry 3653 (class 0 OID 126702)
-- Dependencies: 260
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, organization_id, refresh_token_hash, ip_address, user_agent, last_activity_at, expires_at, created_at) FROM stdin;
\.


--
-- TOC entry 3655 (class 0 OID 126715)
-- Dependencies: 262
-- Data for Name: skus; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.skus (id, organization_id, product_id, sku, unit, price_cents, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3657 (class 0 OID 126726)
-- Dependencies: 264
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, organization_id, branch_id, name, address, contact, email, description, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3658 (class 0 OID 126737)
-- Dependencies: 265
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, role_id, is_active, full_name, first_name, last_name, phone, mfa_enabled, organization_id, branch_id, created_at, updated_at) FROM stdin;
f81b18b1-0aa7-4614-9206-fe4afa81f061	admin@example.com	$2b$10$QfU1PSYxoLSjOGTm3thSm.ZpicqZEVguzdbGOxrGP0V4OEVa5KNLu	1	t	Zaeem  Ul Haq	Zaeem 	Ul Haq	03360391371	f	\N	\N	2025-10-24 19:58:28.587317+05	2025-10-24 20:04:05.745+05
218b4708-26b1-4a86-a6b3-b5483398eb42	tahazaheer12@gmail.com	$2b$12$syd4mL/SjU.KSCMPc97NbOrhw5iI2.4i99/22HYntbdV.8h/aHH4S	2	t	Muhammad Taha Mustafa	Muhammad	Taha Mustafa	03360391371	t	1	\N	2025-10-24 20:05:56.482293+05	2025-10-24 20:05:56.482293+05
b3464267-3953-4f90-8e0a-503e8ec61f80	memonuzair331@gmail.com	$2b$12$waVibC3U6TZ3w3zmmfHm/OMWtrbBV5W/y3qQUSOk9pSofsYT/jr2G	3	t	Uzair Usman	Uzair	Usman	03360391371	t	1	1	2025-10-24 20:07:19.945917+05	2025-10-24 20:07:19.945917+05
2be07a0c-0a4f-44cd-afc3-dd0961f6085b	aizazusman4699@gmail.com	$2b$12$CvvG/mNDXMbryFeSODSSO.Cx5/AUwGhvfc07GpFhbueCO76Mqx2E.	3	t	Aizaz Usman	Aizaz	Usman	03360391371	t	1	2	2025-10-24 20:06:29.584489+05	2025-10-24 20:07:34.31+05
85f34afd-4d98-421e-9672-193adebfc6d6	aijazkhan@gmail.com	$2b$12$Iisx5NmUyPy1ghAG1lNy0eTZtZsW.vu05OMMmAewWs8vEla2p163O	2	t	Aijaz Khan	Aijaz	Khan	\N	f	4	\N	2025-12-06 17:53:08.32497+05	2025-12-06 17:53:08.32497+05
d9e48c35-2f2c-4ea2-8e59-af717a584e6d	ayan@gmail.com	$2b$12$7DWTDjfwYL95xw9MoV9QnuTKXf439Mu5LLKIwRGWMTvpF9oLSdeje	3	t	Ayan Mustafa	Ayan	Mustafa	\N	f	4	5	2025-12-06 17:54:48.820135+05	2025-12-06 17:54:48.820135+05
\.


--
-- TOC entry 3695 (class 0 OID 0)
-- Dependencies: 201
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 11, true);


--
-- TOC entry 3696 (class 0 OID 0)
-- Dependencies: 203
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 73, true);


--
-- TOC entry 3697 (class 0 OID 0)
-- Dependencies: 205
-- Name: branch_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branch_inventory_id_seq', 1, true);


--
-- TOC entry 3698 (class 0 OID 0)
-- Dependencies: 207
-- Name: branch_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branch_products_id_seq', 1, false);


--
-- TOC entry 3699 (class 0 OID 0)
-- Dependencies: 209
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.branches_id_seq', 5, true);


--
-- TOC entry 3700 (class 0 OID 0)
-- Dependencies: 211
-- Name: budgets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.budgets_id_seq', 6, true);


--
-- TOC entry 3701 (class 0 OID 0)
-- Dependencies: 213
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 3, true);


--
-- TOC entry 3702 (class 0 OID 0)
-- Dependencies: 215
-- Name: employee_credentials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employee_credentials_id_seq', 1, true);


--
-- TOC entry 3703 (class 0 OID 0)
-- Dependencies: 217
-- Name: global_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.global_products_id_seq', 3, true);


--
-- TOC entry 3704 (class 0 OID 0)
-- Dependencies: 219
-- Name: head_offices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.head_offices_id_seq', 1, false);


--
-- TOC entry 3705 (class 0 OID 0)
-- Dependencies: 221
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_id_seq', 1, false);


--
-- TOC entry 3706 (class 0 OID 0)
-- Dependencies: 223
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_sync_logs_id_seq', 1, false);


--
-- TOC entry 3707 (class 0 OID 0)
-- Dependencies: 226
-- Name: modifiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.modifiers_id_seq', 1, false);


--
-- TOC entry 3708 (class 0 OID 0)
-- Dependencies: 228
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- TOC entry 3709 (class 0 OID 0)
-- Dependencies: 230
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 8, true);


--
-- TOC entry 3710 (class 0 OID 0)
-- Dependencies: 232
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 5, true);


--
-- TOC entry 3711 (class 0 OID 0)
-- Dependencies: 234
-- Name: org_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.org_metrics_id_seq', 1, false);


--
-- TOC entry 3712 (class 0 OID 0)
-- Dependencies: 236
-- Name: organization_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_inventory_id_seq', 16, true);


--
-- TOC entry 3713 (class 0 OID 0)
-- Dependencies: 238
-- Name: organization_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_products_id_seq', 1, false);


--
-- TOC entry 3714 (class 0 OID 0)
-- Dependencies: 240
-- Name: organization_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_settings_id_seq', 8, true);


--
-- TOC entry 3715 (class 0 OID 0)
-- Dependencies: 242
-- Name: organizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organizations_id_seq', 4, true);


--
-- TOC entry 3716 (class 0 OID 0)
-- Dependencies: 244
-- Name: product_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_assignments_id_seq', 1, false);


--
-- TOC entry 3717 (class 0 OID 0)
-- Dependencies: 246
-- Name: product_import_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_import_batches_id_seq', 1, false);


--
-- TOC entry 3718 (class 0 OID 0)
-- Dependencies: 248
-- Name: product_modifiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_modifiers_id_seq', 1, false);


--
-- TOC entry 3719 (class 0 OID 0)
-- Dependencies: 250
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 1, false);


--
-- TOC entry 3720 (class 0 OID 0)
-- Dependencies: 252
-- Name: refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refunds_id_seq', 5, true);


--
-- TOC entry 3721 (class 0 OID 0)
-- Dependencies: 254
-- Name: restock_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restock_requests_id_seq', 1, false);


--
-- TOC entry 3722 (class 0 OID 0)
-- Dependencies: 256
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.role_permissions_id_seq', 86, true);


--
-- TOC entry 3723 (class 0 OID 0)
-- Dependencies: 258
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 3, true);


--
-- TOC entry 3724 (class 0 OID 0)
-- Dependencies: 261
-- Name: skus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.skus_id_seq', 1, false);


--
-- TOC entry 3725 (class 0 OID 0)
-- Dependencies: 263
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 1, false);


--
-- TOC entry 3207 (class 2606 OID 81985)
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 3211 (class 2606 OID 126325)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3222 (class 2606 OID 126339)
-- Name: branch_inventory branch_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 3231 (class 2606 OID 126359)
-- Name: branch_products branch_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_pkey PRIMARY KEY (id);


--
-- TOC entry 3236 (class 2606 OID 126370)
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- TOC entry 3242 (class 2606 OID 126384)
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- TOC entry 3246 (class 2606 OID 126394)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3248 (class 2606 OID 126409)
-- Name: employee_credentials employee_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_pkey PRIMARY KEY (id);


--
-- TOC entry 3258 (class 2606 OID 126426)
-- Name: global_products global_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_pkey PRIMARY KEY (id);


--
-- TOC entry 3262 (class 2606 OID 126438)
-- Name: head_offices head_offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_offices
    ADD CONSTRAINT head_offices_pkey PRIMARY KEY (id);


--
-- TOC entry 3268 (class 2606 OID 126450)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 3270 (class 2606 OID 126466)
-- Name: inventory_sync_logs inventory_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_sync_logs
    ADD CONSTRAINT inventory_sync_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3279 (class 2606 OID 126475)
-- Name: mfa_codes mfa_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_codes
    ADD CONSTRAINT mfa_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 3284 (class 2606 OID 126490)
-- Name: modifiers modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_pkey PRIMARY KEY (id);


--
-- TOC entry 3291 (class 2606 OID 126502)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3297 (class 2606 OID 126511)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3304 (class 2606 OID 126528)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3308 (class 2606 OID 126530)
-- Name: orders orders_tid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tid_unique UNIQUE (tid);


--
-- TOC entry 3311 (class 2606 OID 126539)
-- Name: org_metrics org_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_metrics
    ADD CONSTRAINT org_metrics_pkey PRIMARY KEY (id);


--
-- TOC entry 3319 (class 2606 OID 126553)
-- Name: organization_inventory organization_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 3325 (class 2606 OID 126571)
-- Name: organization_products organization_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_pkey PRIMARY KEY (id);


--
-- TOC entry 3328 (class 2606 OID 126583)
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3332 (class 2606 OID 126597)
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- TOC entry 3335 (class 2606 OID 126610)
-- Name: product_assignments product_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 3340 (class 2606 OID 126629)
-- Name: product_import_batches product_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_import_batches
    ADD CONSTRAINT product_import_batches_pkey PRIMARY KEY (id);


--
-- TOC entry 3345 (class 2606 OID 126640)
-- Name: product_modifiers product_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_pkey PRIMARY KEY (id);


--
-- TOC entry 3352 (class 2606 OID 126653)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 3356 (class 2606 OID 126663)
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- TOC entry 3361 (class 2606 OID 126677)
-- Name: restock_requests restock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3366 (class 2606 OID 126687)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3370 (class 2606 OID 126701)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3374 (class 2606 OID 126712)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 3378 (class 2606 OID 126723)
-- Name: skus skus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_pkey PRIMARY KEY (id);


--
-- TOC entry 3385 (class 2606 OID 126736)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 3391 (class 2606 OID 126749)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3208 (class 1259 OID 127122)
-- Name: audit_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_branch_idx ON public.audit_logs USING btree (branch_id);


--
-- TOC entry 3209 (class 1259 OID 127120)
-- Name: audit_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_entity_idx ON public.audit_logs USING btree (entity);


--
-- TOC entry 3212 (class 1259 OID 127121)
-- Name: audit_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_org_idx ON public.audit_logs USING btree (organization_id);


--
-- TOC entry 3213 (class 1259 OID 127119)
-- Name: audit_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_user_idx ON public.audit_logs USING btree (user_id);


--
-- TOC entry 3214 (class 1259 OID 127129)
-- Name: branch_inventory_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_active_idx ON public.branch_inventory USING btree (is_active);


--
-- TOC entry 3215 (class 1259 OID 127127)
-- Name: branch_inventory_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_assigned_by_idx ON public.branch_inventory USING btree (assigned_by_user_id);


--
-- TOC entry 3216 (class 1259 OID 127124)
-- Name: branch_inventory_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_branch_idx ON public.branch_inventory USING btree (branch_id);


--
-- TOC entry 3217 (class 1259 OID 127123)
-- Name: branch_inventory_branch_org_inventory_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX branch_inventory_branch_org_inventory_uq ON public.branch_inventory USING btree (branch_id, organization_inventory_id);


--
-- TOC entry 3218 (class 1259 OID 127130)
-- Name: branch_inventory_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_deleted_at_idx ON public.branch_inventory USING btree (deleted_at);


--
-- TOC entry 3219 (class 1259 OID 127125)
-- Name: branch_inventory_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_org_idx ON public.branch_inventory USING btree (organization_id);


--
-- TOC entry 3220 (class 1259 OID 127126)
-- Name: branch_inventory_org_inventory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_org_inventory_idx ON public.branch_inventory USING btree (organization_inventory_id);


--
-- TOC entry 3223 (class 1259 OID 127128)
-- Name: branch_inventory_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_inventory_visible_idx ON public.branch_inventory USING btree (is_visible);


--
-- TOC entry 3224 (class 1259 OID 127137)
-- Name: branch_products_available_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_available_idx ON public.branch_products USING btree (is_available);


--
-- TOC entry 3225 (class 1259 OID 127132)
-- Name: branch_products_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_branch_idx ON public.branch_products USING btree (branch_id);


--
-- TOC entry 3226 (class 1259 OID 127131)
-- Name: branch_products_branch_product_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX branch_products_branch_product_uq ON public.branch_products USING btree (branch_id, global_product_id);


--
-- TOC entry 3227 (class 1259 OID 127134)
-- Name: branch_products_global_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_global_idx ON public.branch_products USING btree (global_product_id);


--
-- TOC entry 3228 (class 1259 OID 127133)
-- Name: branch_products_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_org_idx ON public.branch_products USING btree (organization_id);


--
-- TOC entry 3229 (class 1259 OID 127135)
-- Name: branch_products_org_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_org_product_idx ON public.branch_products USING btree (organization_product_id);


--
-- TOC entry 3232 (class 1259 OID 127136)
-- Name: branch_products_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branch_products_visible_idx ON public.branch_products USING btree (is_visible);


--
-- TOC entry 3233 (class 1259 OID 127140)
-- Name: branches_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branches_name_idx ON public.branches USING btree (name);


--
-- TOC entry 3234 (class 1259 OID 127139)
-- Name: branches_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branches_org_idx ON public.branches USING btree (organization_id);


--
-- TOC entry 3237 (class 1259 OID 127141)
-- Name: branches_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branches_status_idx ON public.branches USING btree (status);


--
-- TOC entry 3238 (class 1259 OID 127144)
-- Name: budgets_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX budgets_branch_idx ON public.budgets USING btree (branch_id);


--
-- TOC entry 3239 (class 1259 OID 127142)
-- Name: budgets_branch_period_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX budgets_branch_period_uq ON public.budgets USING btree (branch_id, period);


--
-- TOC entry 3240 (class 1259 OID 127143)
-- Name: budgets_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX budgets_org_idx ON public.budgets USING btree (organization_id);


--
-- TOC entry 3243 (class 1259 OID 127145)
-- Name: categories_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_name_idx ON public.categories USING btree (name);


--
-- TOC entry 3244 (class 1259 OID 127146)
-- Name: categories_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX categories_org_idx ON public.categories USING btree (organization_id);


--
-- TOC entry 3249 (class 1259 OID 127150)
-- Name: employee_creds_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_creds_active_idx ON public.employee_credentials USING btree (is_active);


--
-- TOC entry 3250 (class 1259 OID 127148)
-- Name: employee_creds_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_creds_branch_idx ON public.employee_credentials USING btree (branch_id);


--
-- TOC entry 3251 (class 1259 OID 127151)
-- Name: employee_creds_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_creds_created_by_idx ON public.employee_credentials USING btree (created_by_user_id);


--
-- TOC entry 3252 (class 1259 OID 127147)
-- Name: employee_creds_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_creds_email_uq ON public.employee_credentials USING btree (email);


--
-- TOC entry 3253 (class 1259 OID 127149)
-- Name: employee_creds_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_creds_org_idx ON public.employee_credentials USING btree (organization_id);


--
-- TOC entry 3254 (class 1259 OID 127154)
-- Name: global_products_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX global_products_category_idx ON public.global_products USING btree (category_id);


--
-- TOC entry 3255 (class 1259 OID 127152)
-- Name: global_products_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX global_products_code_idx ON public.global_products USING btree (product_code);


--
-- TOC entry 3256 (class 1259 OID 127153)
-- Name: global_products_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX global_products_name_idx ON public.global_products USING btree (name);


--
-- TOC entry 3259 (class 1259 OID 127155)
-- Name: global_products_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX global_products_status_idx ON public.global_products USING btree (status);


--
-- TOC entry 3260 (class 1259 OID 127156)
-- Name: head_offices_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX head_offices_org_idx ON public.head_offices USING btree (organization_id);


--
-- TOC entry 3263 (class 1259 OID 127158)
-- Name: inventory_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_branch_idx ON public.inventory USING btree (branch_id);


--
-- TOC entry 3264 (class 1259 OID 127157)
-- Name: inventory_branch_sku_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_branch_sku_uq ON public.inventory USING btree (branch_id, sku_id);


--
-- TOC entry 3265 (class 1259 OID 127160)
-- Name: inventory_org_branch_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_org_branch_sku_idx ON public.inventory USING btree (organization_id, branch_id, sku_id);


--
-- TOC entry 3266 (class 1259 OID 127159)
-- Name: inventory_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_org_idx ON public.inventory USING btree (organization_id);


--
-- TOC entry 3271 (class 1259 OID 127165)
-- Name: inventory_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_sync_logs_started_at_idx ON public.inventory_sync_logs USING btree (started_at);


--
-- TOC entry 3272 (class 1259 OID 127163)
-- Name: inventory_sync_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_sync_logs_status_idx ON public.inventory_sync_logs USING btree (status);


--
-- TOC entry 3273 (class 1259 OID 127162)
-- Name: inventory_sync_logs_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_sync_logs_target_idx ON public.inventory_sync_logs USING btree (target_type, target_id);


--
-- TOC entry 3274 (class 1259 OID 127161)
-- Name: inventory_sync_logs_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_sync_logs_type_idx ON public.inventory_sync_logs USING btree (sync_type);


--
-- TOC entry 3275 (class 1259 OID 127164)
-- Name: inventory_sync_logs_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_sync_logs_user_idx ON public.inventory_sync_logs USING btree (performed_by_user_id);


--
-- TOC entry 3276 (class 1259 OID 127167)
-- Name: mfa_codes_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mfa_codes_code_idx ON public.mfa_codes USING btree (code);


--
-- TOC entry 3277 (class 1259 OID 127168)
-- Name: mfa_codes_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mfa_codes_expires_idx ON public.mfa_codes USING btree (expires_at);


--
-- TOC entry 3280 (class 1259 OID 127169)
-- Name: mfa_codes_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mfa_codes_type_idx ON public.mfa_codes USING btree (type);


--
-- TOC entry 3281 (class 1259 OID 127166)
-- Name: mfa_codes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mfa_codes_user_idx ON public.mfa_codes USING btree (user_id);


--
-- TOC entry 3282 (class 1259 OID 127170)
-- Name: modifiers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modifiers_name_idx ON public.modifiers USING btree (name);


--
-- TOC entry 3285 (class 1259 OID 127172)
-- Name: modifiers_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modifiers_status_idx ON public.modifiers USING btree (status);


--
-- TOC entry 3286 (class 1259 OID 127171)
-- Name: modifiers_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modifiers_type_idx ON public.modifiers USING btree (type);


--
-- TOC entry 3287 (class 1259 OID 127173)
-- Name: modifiers_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX modifiers_user_idx ON public.modifiers USING btree (created_by_user_id);


--
-- TOC entry 3288 (class 1259 OID 127177)
-- Name: notifications_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_branch_idx ON public.notifications USING btree (branch_id);


--
-- TOC entry 3289 (class 1259 OID 127176)
-- Name: notifications_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_org_idx ON public.notifications USING btree (organization_id);


--
-- TOC entry 3292 (class 1259 OID 127175)
-- Name: notifications_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_type_idx ON public.notifications USING btree (type);


--
-- TOC entry 3293 (class 1259 OID 127174)
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id);


--
-- TOC entry 3294 (class 1259 OID 127178)
-- Name: order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);


--
-- TOC entry 3295 (class 1259 OID 127179)
-- Name: order_items_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_org_idx ON public.order_items USING btree (organization_id);


--
-- TOC entry 3298 (class 1259 OID 127180)
-- Name: order_items_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_product_idx ON public.order_items USING btree (global_product_id);


--
-- TOC entry 3299 (class 1259 OID 127182)
-- Name: orders_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_branch_idx ON public.orders USING btree (branch_id);


--
-- TOC entry 3300 (class 1259 OID 127184)
-- Name: orders_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_created_idx ON public.orders USING btree (created_at);


--
-- TOC entry 3301 (class 1259 OID 127186)
-- Name: orders_org_branch_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_org_branch_status_idx ON public.orders USING btree (organization_id, branch_id, status);


--
-- TOC entry 3302 (class 1259 OID 127185)
-- Name: orders_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_org_idx ON public.orders USING btree (organization_id);


--
-- TOC entry 3305 (class 1259 OID 127183)
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- TOC entry 3306 (class 1259 OID 127181)
-- Name: orders_tid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_tid_idx ON public.orders USING btree (tid);


--
-- TOC entry 3312 (class 1259 OID 127192)
-- Name: org_inventory_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_inventory_active_idx ON public.organization_inventory USING btree (is_active);


--
-- TOC entry 3313 (class 1259 OID 127191)
-- Name: org_inventory_assigned_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_inventory_assigned_by_idx ON public.organization_inventory USING btree (assigned_by_user_id);


--
-- TOC entry 3314 (class 1259 OID 127193)
-- Name: org_inventory_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_inventory_deleted_at_idx ON public.organization_inventory USING btree (deleted_at);


--
-- TOC entry 3315 (class 1259 OID 127190)
-- Name: org_inventory_global_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_inventory_global_product_idx ON public.organization_inventory USING btree (global_product_id);


--
-- TOC entry 3316 (class 1259 OID 127189)
-- Name: org_inventory_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_inventory_org_idx ON public.organization_inventory USING btree (organization_id);


--
-- TOC entry 3317 (class 1259 OID 127188)
-- Name: org_inventory_org_product_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_inventory_org_product_uq ON public.organization_inventory USING btree (organization_id, global_product_id);


--
-- TOC entry 3309 (class 1259 OID 127187)
-- Name: org_metrics_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_metrics_org_idx ON public.org_metrics USING btree (organization_id);


--
-- TOC entry 3329 (class 1259 OID 127199)
-- Name: org_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_name_idx ON public.organizations USING btree (name);


--
-- TOC entry 3320 (class 1259 OID 127197)
-- Name: org_products_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_products_enabled_idx ON public.organization_products USING btree (is_enabled);


--
-- TOC entry 3321 (class 1259 OID 127196)
-- Name: org_products_global_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_products_global_idx ON public.organization_products USING btree (global_product_id);


--
-- TOC entry 3322 (class 1259 OID 127195)
-- Name: org_products_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_products_org_idx ON public.organization_products USING btree (organization_id);


--
-- TOC entry 3323 (class 1259 OID 127194)
-- Name: org_products_org_product_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_products_org_product_uq ON public.organization_products USING btree (organization_id, global_product_id);


--
-- TOC entry 3326 (class 1259 OID 127198)
-- Name: org_settings_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_settings_org_idx ON public.organization_settings USING btree (organization_id);


--
-- TOC entry 3330 (class 1259 OID 127200)
-- Name: org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_status_idx ON public.organizations USING btree (status);


--
-- TOC entry 3333 (class 1259 OID 127202)
-- Name: product_assignments_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_assignments_assigned_to_idx ON public.product_assignments USING btree (assigned_to_type, assigned_to_id);


--
-- TOC entry 3336 (class 1259 OID 127201)
-- Name: product_assignments_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_assignments_product_idx ON public.product_assignments USING btree (global_product_id);


--
-- TOC entry 3337 (class 1259 OID 127203)
-- Name: product_assignments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_assignments_user_idx ON public.product_assignments USING btree (performed_by_user_id);


--
-- TOC entry 3338 (class 1259 OID 127206)
-- Name: product_import_batches_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_import_batches_created_at_idx ON public.product_import_batches USING btree (created_at);


--
-- TOC entry 3341 (class 1259 OID 127205)
-- Name: product_import_batches_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_import_batches_status_idx ON public.product_import_batches USING btree (status);


--
-- TOC entry 3342 (class 1259 OID 127204)
-- Name: product_import_batches_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_import_batches_user_idx ON public.product_import_batches USING btree (uploaded_by_user_id);


--
-- TOC entry 3343 (class 1259 OID 127208)
-- Name: product_modifiers_modifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_modifiers_modifier_idx ON public.product_modifiers USING btree (modifier_id);


--
-- TOC entry 3346 (class 1259 OID 127207)
-- Name: product_modifiers_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_modifiers_product_idx ON public.product_modifiers USING btree (product_id);


--
-- TOC entry 3347 (class 1259 OID 127209)
-- Name: product_modifiers_product_modifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_modifiers_product_modifier_idx ON public.product_modifiers USING btree (product_id, modifier_id);


--
-- TOC entry 3348 (class 1259 OID 127210)
-- Name: products_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_idx ON public.products USING btree (category_id);


--
-- TOC entry 3349 (class 1259 OID 127211)
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- TOC entry 3350 (class 1259 OID 127212)
-- Name: products_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_org_idx ON public.products USING btree (organization_id);


--
-- TOC entry 3353 (class 1259 OID 127213)
-- Name: refunds_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_order_idx ON public.refunds USING btree (order_id);


--
-- TOC entry 3354 (class 1259 OID 127214)
-- Name: refunds_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_org_idx ON public.refunds USING btree (organization_id);


--
-- TOC entry 3357 (class 1259 OID 127215)
-- Name: refunds_processed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_processed_by_idx ON public.refunds USING btree (processed_by_user_id);


--
-- TOC entry 3358 (class 1259 OID 127216)
-- Name: restock_requests_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restock_requests_branch_idx ON public.restock_requests USING btree (branch_id);


--
-- TOC entry 3359 (class 1259 OID 127217)
-- Name: restock_requests_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restock_requests_org_idx ON public.restock_requests USING btree (organization_id);


--
-- TOC entry 3362 (class 1259 OID 127218)
-- Name: restock_requests_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restock_requests_product_idx ON public.restock_requests USING btree (global_product_id);


--
-- TOC entry 3363 (class 1259 OID 127220)
-- Name: restock_requests_requested_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restock_requests_requested_by_idx ON public.restock_requests USING btree (requested_by_user_id);


--
-- TOC entry 3364 (class 1259 OID 127219)
-- Name: restock_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restock_requests_status_idx ON public.restock_requests USING btree (status);


--
-- TOC entry 3367 (class 1259 OID 127221)
-- Name: role_permissions_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_permissions_role_idx ON public.role_permissions USING btree (role_id);


--
-- TOC entry 3368 (class 1259 OID 127222)
-- Name: roles_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_name_idx ON public.roles USING btree (name);


--
-- TOC entry 3371 (class 1259 OID 127224)
-- Name: sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_idx ON public.sessions USING btree (expires_at);


--
-- TOC entry 3372 (class 1259 OID 127225)
-- Name: sessions_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_org_idx ON public.sessions USING btree (organization_id);


--
-- TOC entry 3375 (class 1259 OID 127223)
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);


--
-- TOC entry 3376 (class 1259 OID 127228)
-- Name: skus_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skus_org_idx ON public.skus USING btree (organization_id);


--
-- TOC entry 3379 (class 1259 OID 127226)
-- Name: skus_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX skus_product_idx ON public.skus USING btree (product_id);


--
-- TOC entry 3380 (class 1259 OID 127227)
-- Name: skus_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skus_sku_idx ON public.skus USING btree (sku);


--
-- TOC entry 3381 (class 1259 OID 127230)
-- Name: suppliers_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_branch_idx ON public.suppliers USING btree (branch_id);


--
-- TOC entry 3382 (class 1259 OID 127231)
-- Name: suppliers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_name_idx ON public.suppliers USING btree (name);


--
-- TOC entry 3383 (class 1259 OID 127229)
-- Name: suppliers_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX suppliers_org_idx ON public.suppliers USING btree (organization_id);


--
-- TOC entry 3386 (class 1259 OID 127234)
-- Name: users_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_active_idx ON public.users USING btree (is_active);


--
-- TOC entry 3387 (class 1259 OID 127237)
-- Name: users_branch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_branch_idx ON public.users USING btree (branch_id);


--
-- TOC entry 3388 (class 1259 OID 127232)
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- TOC entry 3389 (class 1259 OID 127236)
-- Name: users_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_org_idx ON public.users USING btree (organization_id);


--
-- TOC entry 3392 (class 1259 OID 127233)
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role_id);


--
-- TOC entry 3395 (class 2606 OID 126774)
-- Name: audit_logs audit_logs_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3394 (class 2606 OID 126769)
-- Name: audit_logs audit_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3393 (class 2606 OID 126764)
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3399 (class 2606 OID 126794)
-- Name: branch_inventory branch_inventory_assigned_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_assigned_by_user_id_users_id_fk FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3397 (class 2606 OID 126779)
-- Name: branch_inventory branch_inventory_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3398 (class 2606 OID 126784)
-- Name: branch_inventory branch_inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3396 (class 2606 OID 127244)
-- Name: branch_inventory branch_inventory_organization_inventory_id_organization_invento; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_organization_inventory_id_organization_invento FOREIGN KEY (organization_inventory_id) REFERENCES public.organization_inventory(id) ON DELETE CASCADE;


--
-- TOC entry 3401 (class 2606 OID 126799)
-- Name: branch_products branch_products_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3403 (class 2606 OID 126809)
-- Name: branch_products branch_products_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3402 (class 2606 OID 126804)
-- Name: branch_products branch_products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3400 (class 2606 OID 127249)
-- Name: branch_products branch_products_organization_product_id_organization_products_i; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_organization_product_id_organization_products_i FOREIGN KEY (organization_product_id) REFERENCES public.organization_products(id) ON DELETE CASCADE;


--
-- TOC entry 3404 (class 2606 OID 126819)
-- Name: branch_products branch_products_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3405 (class 2606 OID 126824)
-- Name: branches branches_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3407 (class 2606 OID 126834)
-- Name: budgets budgets_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3406 (class 2606 OID 126829)
-- Name: budgets budgets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3408 (class 2606 OID 126839)
-- Name: categories categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3409 (class 2606 OID 126844)
-- Name: employee_credentials employee_credentials_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3411 (class 2606 OID 126854)
-- Name: employee_credentials employee_credentials_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3410 (class 2606 OID 126849)
-- Name: employee_credentials employee_credentials_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3412 (class 2606 OID 126859)
-- Name: global_products global_products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- TOC entry 3413 (class 2606 OID 126864)
-- Name: global_products global_products_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3414 (class 2606 OID 126869)
-- Name: head_offices head_offices_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_offices
    ADD CONSTRAINT head_offices_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3416 (class 2606 OID 126879)
-- Name: inventory inventory_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3415 (class 2606 OID 126874)
-- Name: inventory inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3417 (class 2606 OID 126884)
-- Name: inventory inventory_sku_id_skus_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_id_skus_id_fk FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- TOC entry 3418 (class 2606 OID 126889)
-- Name: inventory_sync_logs inventory_sync_logs_performed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_sync_logs
    ADD CONSTRAINT inventory_sync_logs_performed_by_user_id_users_id_fk FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3419 (class 2606 OID 126894)
-- Name: mfa_codes mfa_codes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_codes
    ADD CONSTRAINT mfa_codes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3420 (class 2606 OID 126899)
-- Name: modifiers modifiers_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3423 (class 2606 OID 126914)
-- Name: notifications notifications_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3422 (class 2606 OID 126909)
-- Name: notifications notifications_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3421 (class 2606 OID 126904)
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3426 (class 2606 OID 126929)
-- Name: order_items order_items_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3425 (class 2606 OID 126924)
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 3424 (class 2606 OID 126919)
-- Name: order_items order_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3428 (class 2606 OID 126939)
-- Name: orders orders_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3429 (class 2606 OID 126944)
-- Name: orders orders_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3427 (class 2606 OID 126934)
-- Name: orders orders_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3430 (class 2606 OID 126949)
-- Name: org_metrics org_metrics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_metrics
    ADD CONSTRAINT org_metrics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3433 (class 2606 OID 126964)
-- Name: organization_inventory organization_inventory_assigned_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_assigned_by_user_id_users_id_fk FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3432 (class 2606 OID 126959)
-- Name: organization_inventory organization_inventory_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3431 (class 2606 OID 126954)
-- Name: organization_inventory organization_inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3435 (class 2606 OID 126974)
-- Name: organization_products organization_products_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3434 (class 2606 OID 126969)
-- Name: organization_products organization_products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3436 (class 2606 OID 126979)
-- Name: organization_products organization_products_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3437 (class 2606 OID 126984)
-- Name: organization_settings organization_settings_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3438 (class 2606 OID 126989)
-- Name: product_assignments product_assignments_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3439 (class 2606 OID 126994)
-- Name: product_assignments product_assignments_performed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_performed_by_user_id_users_id_fk FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3440 (class 2606 OID 126999)
-- Name: product_import_batches product_import_batches_uploaded_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_import_batches
    ADD CONSTRAINT product_import_batches_uploaded_by_user_id_users_id_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3442 (class 2606 OID 127009)
-- Name: product_modifiers product_modifiers_modifier_id_modifiers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_modifier_id_modifiers_id_fk FOREIGN KEY (modifier_id) REFERENCES public.modifiers(id);


--
-- TOC entry 3441 (class 2606 OID 127004)
-- Name: product_modifiers product_modifiers_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_product_id_global_products_id_fk FOREIGN KEY (product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3444 (class 2606 OID 127019)
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- TOC entry 3443 (class 2606 OID 127014)
-- Name: products products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3446 (class 2606 OID 127029)
-- Name: refunds refunds_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 3445 (class 2606 OID 127024)
-- Name: refunds refunds_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3447 (class 2606 OID 127034)
-- Name: refunds refunds_processed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_processed_by_user_id_users_id_fk FOREIGN KEY (processed_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3448 (class 2606 OID 131465)
-- Name: refunds refunds_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3449 (class 2606 OID 131472)
-- Name: refunds refunds_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3450 (class 2606 OID 127039)
-- Name: restock_requests restock_requests_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3452 (class 2606 OID 127049)
-- Name: restock_requests restock_requests_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- TOC entry 3451 (class 2606 OID 127044)
-- Name: restock_requests restock_requests_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3453 (class 2606 OID 127054)
-- Name: restock_requests restock_requests_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3454 (class 2606 OID 127059)
-- Name: restock_requests restock_requests_reviewed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_reviewed_by_user_id_users_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id);


--
-- TOC entry 3455 (class 2606 OID 127064)
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 3457 (class 2606 OID 127074)
-- Name: sessions sessions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3456 (class 2606 OID 127069)
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3458 (class 2606 OID 127079)
-- Name: skus skus_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3459 (class 2606 OID 127084)
-- Name: skus skus_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 3461 (class 2606 OID 127094)
-- Name: suppliers suppliers_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- TOC entry 3460 (class 2606 OID 127089)
-- Name: suppliers suppliers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3463 (class 2606 OID 127104)
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- TOC entry 3462 (class 2606 OID 127099)
-- Name: users users_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


-- Completed on 2025-12-06 18:43:09

--
-- PostgreSQL database dump complete
--

\unrestrict Kzm0oLhqbv5IgPJ6G2tENnRf8ccqDoWLVyZ7nFSyux7ZLaNWy0vT2LMtrZ2vEPk

