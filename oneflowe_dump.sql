--
-- PostgreSQL database dump
--

\restrict 7zQNonuiwcN4ezvsipnkuIj9hEbFXeABrO6orzIJ8fb25Zz3Pp8iPEZNGarmGcw

-- Dumped from database version 13.22
-- Dumped by pg_dump version 13.22

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

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: postgres
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE drizzle.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: branch_inventory; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.branch_inventory OWNER TO postgres;

--
-- Name: branch_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branch_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.branch_inventory_id_seq OWNER TO postgres;

--
-- Name: branch_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branch_inventory_id_seq OWNED BY public.branch_inventory.id;


--
-- Name: branch_products; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.branch_products OWNER TO postgres;

--
-- Name: branch_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branch_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.branch_products_id_seq OWNER TO postgres;

--
-- Name: branch_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branch_products_id_seq OWNED BY public.branch_products.id;


--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.branches_id_seq OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.budgets OWNER TO postgres;

--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.budgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.budgets_id_seq OWNER TO postgres;

--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    parent_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: employee_credentials; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.employee_credentials OWNER TO postgres;

--
-- Name: employee_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.employee_credentials_id_seq OWNER TO postgres;

--
-- Name: employee_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_credentials_id_seq OWNED BY public.employee_credentials.id;


--
-- Name: global_products; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.global_products OWNER TO postgres;

--
-- Name: global_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.global_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.global_products_id_seq OWNER TO postgres;

--
-- Name: global_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.global_products_id_seq OWNED BY public.global_products.id;


--
-- Name: head_offices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.head_offices (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    name character varying(255) NOT NULL,
    contact_email character varying(255),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.head_offices OWNER TO postgres;

--
-- Name: head_offices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.head_offices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.head_offices_id_seq OWNER TO postgres;

--
-- Name: head_offices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.head_offices_id_seq OWNED BY public.head_offices.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    organization_id integer,
    branch_id integer NOT NULL,
    sku_id integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_id_seq OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- Name: inventory_sync_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.inventory_sync_logs OWNER TO postgres;

--
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_sync_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_sync_logs_id_seq OWNER TO postgres;

--
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_sync_logs_id_seq OWNED BY public.inventory_sync_logs.id;


--
-- Name: mfa_codes; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.mfa_codes OWNER TO postgres;

--
-- Name: modifiers; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.modifiers OWNER TO postgres;

--
-- Name: modifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.modifiers_id_seq OWNER TO postgres;

--
-- Name: modifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modifiers_id_seq OWNED BY public.modifiers.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
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
    updated_at timestamp with time zone DEFAULT now(),
    fulfilled_at timestamp with time zone
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: org_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.org_metrics (
    id integer NOT NULL,
    organization_id integer,
    month character varying(16),
    total_orders integer,
    total_spend_cents integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.org_metrics OWNER TO postgres;

--
-- Name: org_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.org_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.org_metrics_id_seq OWNER TO postgres;

--
-- Name: org_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.org_metrics_id_seq OWNED BY public.org_metrics.id;


--
-- Name: organization_inventory; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.organization_inventory OWNER TO postgres;

--
-- Name: organization_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organization_inventory_id_seq OWNER TO postgres;

--
-- Name: organization_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_inventory_id_seq OWNED BY public.organization_inventory.id;


--
-- Name: organization_products; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.organization_products OWNER TO postgres;

--
-- Name: organization_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organization_products_id_seq OWNER TO postgres;

--
-- Name: organization_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_products_id_seq OWNED BY public.organization_products.id;


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_settings (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    key character varying(128) NOT NULL,
    value jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.organization_settings OWNER TO postgres;

--
-- Name: organization_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organization_settings_id_seq OWNER TO postgres;

--
-- Name: organization_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_settings_id_seq OWNED BY public.organization_settings.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.organizations_id_seq OWNER TO postgres;

--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: product_assignments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.product_assignments OWNER TO postgres;

--
-- Name: product_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_assignments_id_seq OWNER TO postgres;

--
-- Name: product_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_assignments_id_seq OWNED BY public.product_assignments.id;


--
-- Name: product_import_batches; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.product_import_batches OWNER TO postgres;

--
-- Name: product_import_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_import_batches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_import_batches_id_seq OWNER TO postgres;

--
-- Name: product_import_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_import_batches_id_seq OWNED BY public.product_import_batches.id;


--
-- Name: product_modifiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_modifiers (
    id integer NOT NULL,
    product_id integer NOT NULL,
    modifier_id integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_modifiers OWNER TO postgres;

--
-- Name: product_modifiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_modifiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_modifiers_id_seq OWNER TO postgres;

--
-- Name: product_modifiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_modifiers_id_seq OWNED BY public.product_modifiers.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.refunds OWNER TO postgres;

--
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.refunds_id_seq OWNER TO postgres;

--
-- Name: refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;


--
-- Name: restock_requests; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.restock_requests OWNER TO postgres;

--
-- Name: restock_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.restock_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.restock_requests_id_seq OWNER TO postgres;

--
-- Name: restock_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.restock_requests_id_seq OWNED BY public.restock_requests.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    permission_key character varying(128) NOT NULL,
    allowed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.role_permissions_id_seq OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(64) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: skus; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.skus OWNER TO postgres;

--
-- Name: skus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.skus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.skus_id_seq OWNER TO postgres;

--
-- Name: skus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.skus_id_seq OWNED BY public.skus.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.suppliers_id_seq OWNER TO postgres;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: branch_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory ALTER COLUMN id SET DEFAULT nextval('public.branch_inventory_id_seq'::regclass);


--
-- Name: branch_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products ALTER COLUMN id SET DEFAULT nextval('public.branch_products_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: employee_credentials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_credentials ALTER COLUMN id SET DEFAULT nextval('public.employee_credentials_id_seq'::regclass);


--
-- Name: global_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_products ALTER COLUMN id SET DEFAULT nextval('public.global_products_id_seq'::regclass);


--
-- Name: head_offices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.head_offices ALTER COLUMN id SET DEFAULT nextval('public.head_offices_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: inventory_sync_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_sync_logs ALTER COLUMN id SET DEFAULT nextval('public.inventory_sync_logs_id_seq'::regclass);


--
-- Name: modifiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modifiers ALTER COLUMN id SET DEFAULT nextval('public.modifiers_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: org_metrics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_metrics ALTER COLUMN id SET DEFAULT nextval('public.org_metrics_id_seq'::regclass);


--
-- Name: organization_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_inventory ALTER COLUMN id SET DEFAULT nextval('public.organization_inventory_id_seq'::regclass);


--
-- Name: organization_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_products ALTER COLUMN id SET DEFAULT nextval('public.organization_products_id_seq'::regclass);


--
-- Name: organization_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings ALTER COLUMN id SET DEFAULT nextval('public.organization_settings_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: product_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_assignments ALTER COLUMN id SET DEFAULT nextval('public.product_assignments_id_seq'::regclass);


--
-- Name: product_import_batches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_import_batches ALTER COLUMN id SET DEFAULT nextval('public.product_import_batches_id_seq'::regclass);


--
-- Name: product_modifiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_modifiers ALTER COLUMN id SET DEFAULT nextval('public.product_modifiers_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: refunds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);


--
-- Name: restock_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests ALTER COLUMN id SET DEFAULT nextval('public.restock_requests_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: skus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skus ALTER COLUMN id SET DEFAULT nextval('public.skus_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
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
12	76416dbcd658e9abacc963bc7e29b8fada64dbf25f26a7ea31c392a187baaaea	1765810896231
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
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
74	b3464267-3953-4f90-8e0a-503e8ec61f80	1	\N	CREATE_EMPLOYEE_CREDENTIAL	EMPLOYEE_CREDENTIAL	3	{"email": "ebad@gmail.com", "branchId": 1}	2025-12-15 18:00:45.546359+05
75	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	6	{"tid": "mj770wg02itu39xo", "items": 1, "total": 30000}	2025-12-15 18:32:17.089787+05
76	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	7	{"tid": "mj771jomq8jabybq", "items": 3, "total": 84000}	2025-12-15 18:32:47.207826+05
77	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	7	{"tid": "mj771jomq8jabybq", "action": "approve"}	2025-12-15 18:41:03.213733+05
78	\N	1	1	AUTO_APPROVE	Order	6	{"tid": "mj770wg02itu39xo", "reason": "auto_approved_after_2_hours"}	2025-12-15 20:57:08.23558+05
79	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	7	{"tid": "mj771jomq8jabybq", "action": "fulfill"}	2025-12-16 15:35:41.071252+05
80	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	6	{"tid": "mj770wg02itu39xo", "action": "fulfill"}	2025-12-16 15:42:55.430676+05
81	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	8	{"tid": "mj8h4pf6yxyd493l", "items": 2, "total": 54000}	2025-12-16 16:02:56.95262+05
82	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	8	{"tid": "mj8h4pf6yxyd493l", "action": "cancel"}	2025-12-16 16:09:59.447474+05
83	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	9	{"tid": "mj8hexlnxchda8po", "items": 1, "total": 30000}	2025-12-16 16:10:54.120659+05
84	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	10	{"tid": "mj8hexxe688i53tm", "items": 1, "total": 30000}	2025-12-16 16:10:54.531594+05
85	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	9	{"tid": "mj8hexlnxchda8po", "action": "approve"}	2025-12-16 16:11:05.071676+05
86	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	10	{"tid": "mj8hexxe688i53tm", "action": "approve"}	2025-12-16 16:11:10.906001+05
87	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	9	{"tid": "mj8hexlnxchda8po", "action": "fulfill"}	2025-12-16 16:12:55.876852+05
88	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	10	{"tid": "mj8hexxe688i53tm", "action": "fulfill"}	2025-12-16 16:12:58.303339+05
89	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	10	{"tid": "mj8hexxe688i53tm", "action": "fulfill"}	2025-12-16 16:13:09.849561+05
90	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	11	{"tid": "mj8hpe4i7q00bu09", "items": 1, "total": 30000}	2025-12-16 16:19:02.083159+05
91	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	11	{"tid": "mj8hpe4i7q00bu09", "action": "approve"}	2025-12-16 16:19:16.693879+05
92	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	11	{"tid": "mj8hpe4i7q00bu09", "action": "fulfill"}	2025-12-16 16:19:28.16704+05
93	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	12	{"tid": "mj8hxh140s5m3cmz", "items": 1, "total": 30000}	2025-12-16 16:25:19.098634+05
94	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	12	{"tid": "mj8hxh140s5m3cmz", "action": "approve"}	2025-12-16 16:25:36.588518+05
95	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	12	{"tid": "mj8hxh140s5m3cmz", "action": "fulfill"}	2025-12-16 16:25:43.719384+05
96	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	13	{"tid": "mj8ic2befdymshnr", "items": 1, "total": 30000}	2025-12-16 16:36:39.867645+05
97	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	13	{"tid": "mj8ic2befdymshnr", "action": "approve"}	2025-12-16 16:47:28.927766+05
98	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	13	{"tid": "mj8ic2befdymshnr", "action": "fulfill"}	2025-12-16 16:47:33.615513+05
99	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	14	{"tid": "mja1h7l69r3ztah8", "items": 2, "total": 80000}	2025-12-17 18:20:18.86496+05
100	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	14	{"tid": "mja1h7l69r3ztah8", "action": "approve"}	2025-12-17 18:22:22.7429+05
101	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	14	{"tid": "mja1h7l69r3ztah8", "action": "fulfill"}	2025-12-17 18:22:25.476593+05
102	93e0c992-3a85-4b6e-8222-40d0792a9465	2	3	CREATE_ORDER	Order	15	{"tid": "mja29k0hwg556wnt", "items": 1, "total": 40000}	2025-12-17 18:42:21.330665+05
103	f81b18b1-0aa7-4614-9206-fe4afa81f061	2	3	UPDATE	Order	15	{"tid": "mja29k0hwg556wnt", "action": "approve"}	2025-12-17 18:44:59.145899+05
104	f81b18b1-0aa7-4614-9206-fe4afa81f061	2	3	UPDATE	Order	15	{"tid": "mja29k0hwg556wnt", "action": "fulfill"}	2025-12-17 18:45:01.255883+05
105	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	CREATE_BUDGET_ALLOCATION	BUDGET	3	{"amount": 3000, "period": "2025-12", "branchName": "Malir Halt Branch"}	2025-12-17 18:47:28.962443+05
106	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	3	{"newAmount": 3000, "oldAmount": 3000, "branchName": "Malir Halt Branch"}	2025-12-17 18:49:01.704673+05
107	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	16	{"tid": "mja2siq9gkmu2uoc", "items": 3, "total": 84000}	2025-12-17 18:57:06.132189+05
108	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	16	{"tid": "mja2siq9gkmu2uoc", "action": "approve"}	2025-12-17 19:01:16.358045+05
109	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	16	{"tid": "mja2siq9gkmu2uoc", "action": "fulfill"}	2025-12-17 19:01:23.984378+05
110	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	17	{"tid": "mjhdloxpqnedh4hm", "items": 2, "total": 80000}	2025-12-22 21:34:06.595972+05
111	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	17	{"tid": "mjhdloxpqnedh4hm", "action": "approve"}	2025-12-22 21:34:54.013077+05
112	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	17	{"tid": "mjhdloxpqnedh4hm", "action": "fulfill"}	2025-12-22 21:34:57.391641+05
113	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	20	{"tid": "mjhew8ysmslwedlv", "items": 3, "total": 84000}	2025-12-22 22:10:18.727333+05
114	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	20	{"tid": "mjhew8ysmslwedlv", "action": "approve"}	2025-12-22 22:10:45.366635+05
115	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	20	{"tid": "mjhew8ysmslwedlv", "action": "fulfill"}	2025-12-22 22:10:47.611709+05
116	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	21	{"tid": "mjigm4ytppdpth75", "items": 1, "total": 30000}	2025-12-23 15:46:12.392472+05
117	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	22	{"tid": "mjigm9qu6uk0ulga", "items": 1, "total": 50000}	2025-12-23 15:46:18.584129+05
118	b3464267-3953-4f90-8e0a-503e8ec61f80	1	1	CREATE_ORDER	Order	23	{"tid": "mjign5a7ordb41f3", "items": 1, "total": 12000}	2025-12-23 15:46:59.457538+05
119	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	21	{"tid": "mjigm4ytppdpth75", "action": "approve"}	2025-12-23 15:47:44.089904+05
120	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	22	{"tid": "mjigm9qu6uk0ulga", "action": "approve"}	2025-12-23 15:47:48.801573+05
121	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	23	{"tid": "mjign5a7ordb41f3", "action": "approve"}	2025-12-23 15:47:52.310218+05
122	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	23	{"tid": "mjign5a7ordb41f3", "action": "fulfill"}	2025-12-23 15:47:58.645949+05
123	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	22	{"tid": "mjigm9qu6uk0ulga", "action": "fulfill"}	2025-12-23 15:48:00.211148+05
124	f81b18b1-0aa7-4614-9206-fe4afa81f061	1	1	UPDATE	Order	21	{"tid": "mjigm4ytppdpth75", "action": "fulfill"}	2025-12-23 15:48:01.088429+05
125	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	3	{"newAmount": 3000, "oldAmount": 3000, "branchName": "Malir Halt Branch"}	2025-12-23 16:04:51.494997+05
126	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	2	{"newAmount": 2000, "oldAmount": 6000, "branchName": "Gulberg Branch"}	2025-12-23 16:05:36.53872+05
127	f81b18b1-0aa7-4614-9206-fe4afa81f061	\N	\N	UPDATE_BUDGET_ALLOCATION	BUDGET	1	{"newAmount": 2000, "oldAmount": 6000, "branchName": "Malir Halt Branch"}	2025-12-23 16:05:36.90849+05
\.


--
-- Data for Name: branch_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branch_inventory (id, branch_id, organization_id, organization_inventory_id, assigned_by_user_id, is_visible, is_active, assigned_at, updated_at, deleted_at) FROM stdin;
1	1	1	1	218b4708-26b1-4a86-a6b3-b5483398eb42	t	t	2025-11-20 17:33:29.985198+05	2025-11-20 17:33:29.985198+05	\N
\.


--
-- Data for Name: branch_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branch_products (id, branch_id, organization_id, global_product_id, organization_product_id, is_visible, is_available, custom_notes, metadata, updated_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, organization_id, name, admin_user_id, code, status, created_at, updated_at) FROM stdin;
2	1	Gulberg Branch	\N	9912	active	2025-10-24 19:27:12.012185+05	2025-10-24 19:27:12.012185+05
3	2	Malir Halt Branch	\N	9913	active	2025-11-20 17:39:38.276003+05	2025-11-20 17:39:38.276003+05
4	3	ABC Branch	\N	8816	active	2025-11-20 19:03:34.975928+05	2025-11-20 19:03:34.975928+05
1	1	Malir Halt Branch	\N	9913	active	2025-10-24 19:26:57.36177+05	2025-10-24 19:26:57.36177+05
5	4	Sharah-e faisal Branch	\N	SF-02	active	2025-12-06 17:51:24.803626+05	2025-12-06 17:51:24.803626+05
6	5	cantbranch 	\N	FT-23	active	2025-12-09 20:55:42.970725+05	2025-12-09 20:55:42.970725+05
7	5	model	\N	9913	active	2025-12-09 20:58:37.151712+05	2025-12-09 20:58:37.151712+05
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.budgets (id, organization_id, branch_id, period, amount_allocated_cents, amount_spent_cents, amount_held_cents, amount_credited_cents, created_at, updated_at) FROM stdin;
2	1	2	2025-11	200000	0	0	0	2025-11-20 17:34:34.242711+05	2025-12-05 21:48:57.383+05
6	4	5	2025-12	450000	93000	0	0	2025-12-06 18:13:11.074897+05	2025-12-06 18:13:29.709+05
3	2	3	2025-11	50000	40000	0	0	2025-11-20 19:27:35.418812+05	2025-11-20 19:27:35.418812+05
1	1	1	2025-11	500000	772000	-30000	250000	2025-11-17 17:29:28.81067+05	2025-12-05 21:46:25.216+05
7	2	3	2025-12	300000	0	0	0	2025-12-17 18:47:28.952049+05	2025-12-23 16:04:51.481+05
4	1	2	2025-12	200000	0	0	0	2025-12-05 22:25:45.939942+05	2025-12-23 16:05:36.532+05
5	1	1	2025-12	200000	0	0	0	2025-12-05 22:26:01.708091+05	2025-12-23 16:05:36.902+05
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, organization_id, name, parent_id, created_at, updated_at) FROM stdin;
1	\N	Dairy	\N	2025-10-28 16:00:48.167317+05	2025-10-28 16:00:48.167317+05
2	\N	Juice	\N	2025-11-20 18:46:18.729376+05	2025-11-20 19:11:42.767+05
3	\N	Canned	2	2025-12-02 17:35:48.190936+05	2025-12-02 17:36:46.941+05
\.


--
-- Data for Name: employee_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_credentials (id, branch_id, organization_id, email, password_hash, first_name, last_name, mfa_enabled, mfa_secret, is_active, created_by_user_id, created_at, updated_at, deactivated_at) FROM stdin;
1	1	1	johndoe@example.com	$2b$10$c4berTLBcLfGL5cbYTXZmeAK0H6.Cm2mlYYLQqcIDSDrLkBoOMNVy	John 	Doe	t	\N	t	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-11-20 18:20:47.382068+05	2025-11-20 18:20:47.382068+05	\N
3	1	1	ebad@gmail.com	$2b$10$HrhMghmb9ytX0NWdiz1CcOdj9.MEyUu0XOLGVRLQMzAjJQ5m6r9Pq	ebad	khan	f	\N	t	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-15 18:00:45.538221+05	2025-12-15 18:00:45.538221+05	\N
\.


--
-- Data for Name: global_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.global_products (id, product_code, name, description, category_id, image_url, base_price_cents, unit, status, metadata, created_by_user_id, created_at, updated_at, last_synced_at, discount_type, discount_value_cents, discount_start_at, discount_end_at, discount_active, stock_quantity) FROM stdin;
2	PRD-001	Tang		2	/uploads/products/product_1763646296533_l9v5s4jjog.jpg	20000	box	active	{"subCategoryId": 3}	\N	2025-11-20 18:45:13.02965+05	2025-12-23 15:46:12.415+05	\N	\N	\N	\N	\N	f	38
1	PRD-002	Olpers Milk		1	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHHvWtqG9OMjF08ITxD3_bY3IopURhJN6YTw&s	50000	ltr	active	{}	\N	2025-11-20 16:29:16.131975+05	2025-12-23 15:46:18.597+05	\N	percent	10	\N	\N	t	57
3	PRD-004	ABC Juice 		2	https://media.naheed.pk/catalog/product/cache/2f2d0cb0c5f92580479e8350be94f387/1/2/1240061-1.jpg	4000	unit	active	{"subCategoryId": 3}	\N	2025-12-02 19:33:39.174849+05	2025-12-23 15:46:59.487+05	\N	\N	\N	\N	\N	f	12
\.


--
-- Data for Name: head_offices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.head_offices (id, organization_id, name, contact_email, created_at) FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, organization_id, branch_id, sku_id, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_sync_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_sync_logs (id, sync_type, trigger_level, target_type, target_id, affected_products, changes_count, status, error_message, performed_by_user_id, started_at, completed_at, metadata) FROM stdin;
\.


--
-- Data for Name: mfa_codes; Type: TABLE DATA; Schema: public; Owner: postgres
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
c594af89-7738-40d1-94a5-712a6dba43bf	218b4708-26b1-4a86-a6b3-b5483398eb42	228713	LOGIN	2025-12-09 20:44:25.128+05	0	f	2025-12-09 20:42:25.13364+05
8c835cf8-03be-4f3b-bc4e-68d159b0e6cc	218b4708-26b1-4a86-a6b3-b5483398eb42	127641	LOGIN	2025-12-09 20:48:05.799+05	0	f	2025-12-09 20:46:05.804521+05
daa9cec2-f1d2-4dec-bdf7-352ef928dee8	218b4708-26b1-4a86-a6b3-b5483398eb42	832847	LOGIN	2025-12-09 20:48:44.849+05	0	t	2025-12-09 20:46:44.867379+05
89f38593-bb11-4e7a-be3b-845693120bf9	218b4708-26b1-4a86-a6b3-b5483398eb42	770411	LOGIN	2025-12-15 17:48:47.571+05	0	t	2025-12-15 17:46:47.578202+05
5cf075b0-17c9-4132-90cf-c39e9389a493	b3464267-3953-4f90-8e0a-503e8ec61f80	969126	LOGIN	2025-12-15 18:01:20.5+05	0	t	2025-12-15 17:59:20.503228+05
aca7d41f-49d0-4865-99f2-013d741cac63	b3464267-3953-4f90-8e0a-503e8ec61f80	875100	LOGIN	2025-12-15 18:33:29.61+05	0	t	2025-12-15 18:31:29.61343+05
1eaf9bde-b4c7-4125-97f8-ade507a12436	b3464267-3953-4f90-8e0a-503e8ec61f80	432584	LOGIN	2025-12-15 18:36:37.829+05	0	f	2025-12-15 18:34:37.830925+05
f250961e-fc15-4fbf-b094-7cdd3f088612	b3464267-3953-4f90-8e0a-503e8ec61f80	174420	LOGIN	2025-12-15 18:37:08.435+05	0	f	2025-12-15 18:35:08.43783+05
bf18a2c5-49f1-4711-b960-323ebd9e40c7	b3464267-3953-4f90-8e0a-503e8ec61f80	505483	LOGIN	2025-12-15 18:38:44.305+05	0	t	2025-12-15 18:36:44.311042+05
a9032934-24db-450e-94f6-fffcb02bb41c	b3464267-3953-4f90-8e0a-503e8ec61f80	764002	LOGIN	2025-12-16 13:58:51.022+05	0	t	2025-12-16 13:56:51.027018+05
0fc9ead3-cb1a-4c28-986f-8581194fa86e	b3464267-3953-4f90-8e0a-503e8ec61f80	151874	LOGIN	2025-12-16 14:00:01.877+05	0	t	2025-12-16 13:58:01.886821+05
b6ce2578-912f-413b-b23f-d5a14d697917	b3464267-3953-4f90-8e0a-503e8ec61f80	129547	LOGIN	2025-12-16 16:03:24.72+05	0	t	2025-12-16 16:01:24.748945+05
6e132fda-bd50-4096-8ce3-d0b6594c2090	b3464267-3953-4f90-8e0a-503e8ec61f80	677406	LOGIN	2025-12-16 16:09:57.196+05	0	t	2025-12-16 16:07:57.256267+05
74991e80-8b6f-45e9-9e6b-d5f6ff8a1ab7	b3464267-3953-4f90-8e0a-503e8ec61f80	776669	LOGIN	2025-12-17 18:18:56.783+05	0	t	2025-12-17 18:16:56.795576+05
c6244e77-dcd0-4087-be48-7aefbb12f710	b3464267-3953-4f90-8e0a-503e8ec61f80	556349	LOGIN	2025-12-17 18:56:18.383+05	0	t	2025-12-17 18:54:18.384514+05
39941a68-cb8c-462e-a2dc-e4cc4ca1c6b7	b3464267-3953-4f90-8e0a-503e8ec61f80	799686	LOGIN	2025-12-22 21:34:00.783+05	0	t	2025-12-22 21:32:00.994402+05
cce80e40-beff-4b25-b8e3-34e4358206a6	b3464267-3953-4f90-8e0a-503e8ec61f80	461942	LOGIN	2025-12-22 22:11:17.431+05	0	t	2025-12-22 22:09:17.442767+05
67feb7a1-96e8-473b-9a80-640f6954e8d6	b3464267-3953-4f90-8e0a-503e8ec61f80	899258	LOGIN	2025-12-23 15:46:33.052+05	0	t	2025-12-23 15:44:33.059462+05
\.


--
-- Data for Name: modifiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.modifiers (id, name, description, type, status, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, organization_id, branch_id, type, target_role, message, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
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
9	1	6	2	Tang	PRD-001	box	1	30000	2025-12-15 18:32:17.089787+05
10	1	7	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-15 18:32:47.207826+05
11	1	7	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-15 18:32:47.207826+05
12	1	7	2	Tang	PRD-001	box	1	30000	2025-12-15 18:32:47.207826+05
13	1	8	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-16 16:02:56.95262+05
14	1	8	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-16 16:02:56.95262+05
15	1	9	2	Tang	PRD-001	box	1	30000	2025-12-16 16:10:54.120659+05
16	1	10	2	Tang	PRD-001	box	1	30000	2025-12-16 16:10:54.531594+05
17	1	11	2	Tang	PRD-001	box	1	30000	2025-12-16 16:19:02.083159+05
18	1	12	2	Tang	PRD-001	box	1	30000	2025-12-16 16:25:19.098634+05
19	1	13	2	Tang	PRD-001	box	1	30000	2025-12-16 16:36:39.867645+05
20	1	14	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-17 18:20:18.86496+05
21	1	14	2	Tang	PRD-001	box	1	30000	2025-12-17 18:20:18.86496+05
22	2	15	1	Olpers Milk	PRD-002	ltr	1	40000	2025-12-17 18:42:21.330665+05
23	1	16	2	Tang	PRD-001	box	1	30000	2025-12-17 18:57:06.132189+05
24	1	16	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-17 18:57:06.132189+05
25	1	16	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-17 18:57:06.132189+05
26	1	17	2	Tang	PRD-001	box	1	30000	2025-12-22 21:34:06.595972+05
27	1	17	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-22 21:34:06.595972+05
28	1	20	3	ABC Juice 	PRD-004	unit	1	4000	2025-12-22 22:10:18.727333+05
29	1	20	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-22 22:10:18.727333+05
30	1	20	2	Tang	PRD-001	box	1	30000	2025-12-22 22:10:18.727333+05
31	1	21	2	Tang	PRD-001	box	1	30000	2025-12-23 15:46:12.392472+05
32	1	22	1	Olpers Milk	PRD-002	ltr	1	50000	2025-12-23 15:46:18.584129+05
33	1	23	3	ABC Juice 	PRD-004	unit	3	4000	2025-12-23 15:46:59.457538+05
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, tid, organization_id, branch_id, status, subtotal_cents, tax_cents, total_cents, notes, created_by_user_id, created_at, updated_at, fulfilled_at) FROM stdin;
23	mjign5a7ordb41f3	1	1	fulfilled	12000	0	12000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-23 15:46:59.457538+05	2025-12-23 15:46:59.457538+05	2025-12-23 15:47:58.645+05
1	mi7hbpnlit8ie1ts	1	1	refunded	50000	0	50000	\N	218b4708-26b1-4a86-a6b3-b5483398eb42	2025-11-20 18:40:55.334907+05	2025-11-20 18:40:55.334907+05	\N
22	mjigm9qu6uk0ulga	1	1	fulfilled	50000	0	50000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-23 15:46:18.584129+05	2025-12-23 15:46:18.584129+05	2025-12-23 15:48:00.21+05
2	mi7it9uiym6rnzul	1	1	refunded	50000	0	50000	\N	218b4708-26b1-4a86-a6b3-b5483398eb42	2025-11-20 19:22:34.268003+05	2025-11-20 19:22:34.268003+05	\N
21	mjigm4ytppdpth75	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-23 15:46:12.392472+05	2025-12-23 15:46:12.392472+05	2025-12-23 15:48:01.087+05
8	mj8h4pf6yxyd493l	1	1	cancelled	54000	0	54000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:02:56.95262+05	2025-12-16 16:02:56.95262+05	\N
4	miubmcz5chzklkl1	1	1	fulfilled	154000	0	154000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-06 18:19:56.470797+05	2025-12-06 18:19:56.470797+05	2025-01-10 15:00:00+05
3	mitjsplamqtvlcfn	1	1	fulfilled	54000	0	54000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-06 05:21:03.504726+05	2025-12-06 05:21:03.504726+05	2025-01-10 15:00:00+05
5	miubpgx2wcar3u8l	4	5	fulfilled	93000	0	93000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-06 18:22:21.543473+05	2025-12-06 18:22:21.543473+05	2025-02-12 19:00:00+05
6	mj770wg02itu39xo	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-15 18:32:17.089787+05	2025-12-15 20:57:08.235+05	2025-02-12 19:00:00+05
7	mj771jomq8jabybq	1	1	fulfilled	84000	0	84000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-15 18:32:47.207826+05	2025-12-15 18:32:47.207826+05	2025-03-15 16:00:00+05
9	mj8hexlnxchda8po	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:10:54.120659+05	2025-12-16 16:10:54.120659+05	2025-03-15 16:00:00+05
10	mj8hexxe688i53tm	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:10:54.531594+05	2025-12-16 16:10:54.531594+05	2025-04-20 20:00:00+05
11	mj8hpe4i7q00bu09	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:19:02.083159+05	2025-12-16 16:19:02.083159+05	2025-04-20 20:00:00+05
13	mj8ic2befdymshnr	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:36:39.867645+05	2025-12-16 16:36:39.867645+05	2025-05-05 17:30:00+05
12	mj8hxh140s5m3cmz	1	1	fulfilled	30000	0	30000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-16 16:25:19.098634+05	2025-12-16 16:25:19.098634+05	2025-05-05 17:30:00+05
14	mja1h7l69r3ztah8	1	1	fulfilled	80000	0	80000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-17 18:20:18.86496+05	2025-12-17 18:20:18.86496+05	2025-06-18 21:45:00+05
15	mja29k0hwg556wnt	2	3	fulfilled	40000	0	40000	\N	93e0c992-3a85-4b6e-8222-40d0792a9465	2025-12-17 18:42:21.330665+05	2025-12-17 18:42:21.330665+05	2025-06-18 21:45:00+05
16	mja2siq9gkmu2uoc	1	1	fulfilled	84000	0	84000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-17 18:57:06.132189+05	2025-12-17 18:57:06.132189+05	2025-07-08 18:20:00+05
17	mjhdloxpqnedh4hm	1	1	fulfilled	80000	0	80000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-22 21:34:06.595972+05	2025-12-22 21:34:06.595972+05	2025-07-08 18:20:00+05
20	mjhew8ysmslwedlv	1	1	fulfilled	84000	0	84000	\N	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-22 22:10:18.727333+05	2025-12-22 22:10:18.727333+05	2025-12-22 22:10:47.611+05
\.


--
-- Data for Name: org_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.org_metrics (id, organization_id, month, total_orders, total_spend_cents, created_at) FROM stdin;
\.


--
-- Data for Name: organization_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: organization_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_products (id, organization_id, global_product_id, is_enabled, custom_name, custom_description, custom_price_cents, custom_image_url, tags, priority, override_level, metadata, updated_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_settings; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, code, status, logo_url, created_at, updated_at) FROM stdin;
1	Meezan Bank	BANK-001	active	\N	2025-10-24 19:26:44.101136+05	2025-10-24 19:26:44.101136+05
2	HBL Bank	BANK-002	active	\N	2025-11-20 17:39:21.734852+05	2025-11-20 17:39:21.734852+05
3	Swenta	CORP-001	active	\N	2025-11-20 19:03:17.370599+05	2025-11-20 19:03:17.370599+05
4	Systems ltd	12187	active	\N	2025-12-06 17:50:40.202806+05	2025-12-06 17:50:40.202806+05
5	virtusoft	001-232	active	\N	2025-12-09 20:54:31.255591+05	2025-12-09 20:54:31.255591+05
\.


--
-- Data for Name: product_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_assignments (id, global_product_id, assigned_to_type, assigned_to_id, action, performed_by_user_id, performed_by_role, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: product_import_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_import_batches (id, file_name, uploaded_by_user_id, total_rows, successful_rows, failed_rows, status, validation_errors, imported_product_ids, metadata, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: product_modifiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_modifiers (id, product_id, modifier_id, is_default, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, organization_id, name, category_id, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refunds (id, organization_id, order_id, amount_cents, reason, processed_by_user_id, created_at, updated_at, status, requested_by_user_id) FROM stdin;
1	1	1	50000	Don't Like the Product and returning it	b3464267-3953-4f90-8e0a-503e8ec61f80	2025-12-01 20:09:04.764533+05	2025-12-01 20:09:04.764533+05	PENDING	\N
2	1	2	50000	\N	\N	2025-12-01 20:28:04.227696+05	2025-12-01 20:28:04.227696+05	PENDING	b3464267-3953-4f90-8e0a-503e8ec61f80
3	1	2	50000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-01 20:28:59.398344+05	2025-12-01 20:28:59.398344+05	APPROVED	\N
4	1	4	150000	Product was expired	\N	2025-12-06 18:24:31.96027+05	2025-12-06 18:24:31.96027+05	PENDING	218b4708-26b1-4a86-a6b3-b5483398eb42
5	1	4	150000	\N	f81b18b1-0aa7-4614-9206-fe4afa81f061	2025-12-06 18:25:34.903114+05	2025-12-06 18:25:34.903114+05	APPROVED	\N
\.


--
-- Data for Name: restock_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.restock_requests (id, branch_id, organization_id, global_product_id, requested_quantity, current_stock, reason, status, requested_by_user_id, reviewed_by_user_id, reviewed_at, review_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
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
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, permissions, created_at, updated_at) FROM stdin;
1	SUPER_ADMIN	Full system access with all permissions	{"org:edit": true, "org:view": true, "user:edit": true, "user:view": true, "order:edit": true, "order:view": true, "org:create": true, "org:delete": true, "user:create": true, "user:delete": true, "order:cancel": true, "order:create": true, "order:delete": true, "order:reject": true, "order:approve": true, "settings:edit": true, "settings:view": true, "inventory:edit": true, "inventory:view": true, "order:view_all": true, "reports:export": true, "user:manage_mfa": true, "inventory:adjust": true, "inventory:create": true, "inventory:delete": true, "org:view_metrics": true, "reports:schedule": true, "reports:view_all": true, "user:manage_roles": true, "inventory:transfer": true, "system:full_access": true, "system:view_health": true, "user:view_sessions": true, "org:manage_branches": true, "org:manage_settings": true, "reports:view_branch": true, "system:manage_roles": true, "user:reset_password": true, "finance:view_budgets": true, "finance:view_reports": true, "finance:manage_budgets": true, "system:view_audit_logs": true, "finance:approve_expenses": true, "settings:manage_products": true, "reports:view_organization": true, "system:manage_permissions": true, "inventory:manage_suppliers": true, "settings:manage_categories": true, "inventory:manage_warehouses": true}	2025-10-24 19:58:27.988249+05	2025-10-24 19:58:28.089+05
2	HEAD_OFFICE	Organization-level management and oversight	{"org:edit": true, "org:view": true, "user:edit": true, "user:view": true, "order:view": true, "user:create": true, "order:reject": true, "order:approve": true, "settings:edit": true, "settings:view": true, "inventory:view": true, "order:view_all": true, "reports:export": true, "org:view_metrics": true, "reports:view_all": true, "user:manage_roles": true, "org:manage_branches": true, "org:manage_settings": true, "finance:view_budgets": true, "finance:view_reports": true, "finance:manage_budgets": true, "finance:approve_expenses": true, "reports:view_organization": true}	2025-10-24 19:58:28.017676+05	2025-10-24 19:58:28.124+05
3	BRANCH_ADMIN	Branch-level operations and management	{"user:view": true, "order:edit": true, "order:view": true, "user:create": true, "order:create": true, "settings:view": true, "inventory:edit": true, "inventory:view": true, "reports:export": true, "inventory:adjust": true, "inventory:create": true, "reports:view_branch": true, "finance:view_budgets": true, "inventory:manage_suppliers": true}	2025-10-24 19:58:28.027107+05	2025-10-24 19:58:28.138+05
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, user_id, organization_id, refresh_token_hash, ip_address, user_agent, last_activity_at, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: skus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.skus (id, organization_id, product_id, sku, unit, price_cents, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, organization_id, branch_id, name, address, contact, email, description, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, role_id, is_active, full_name, first_name, last_name, phone, mfa_enabled, organization_id, branch_id, created_at, updated_at) FROM stdin;
f81b18b1-0aa7-4614-9206-fe4afa81f061	admin@example.com	$2b$10$QfU1PSYxoLSjOGTm3thSm.ZpicqZEVguzdbGOxrGP0V4OEVa5KNLu	1	t	Zaeem  Ul Haq	Zaeem 	Ul Haq	03360391371	f	\N	\N	2025-10-24 19:58:28.587317+05	2025-10-24 20:04:05.745+05
218b4708-26b1-4a86-a6b3-b5483398eb42	tahazaheer12@gmail.com	$2b$12$syd4mL/SjU.KSCMPc97NbOrhw5iI2.4i99/22HYntbdV.8h/aHH4S	2	t	Muhammad Taha Mustafa	Muhammad	Taha Mustafa	03360391371	t	1	\N	2025-10-24 20:05:56.482293+05	2025-10-24 20:05:56.482293+05
2be07a0c-0a4f-44cd-afc3-dd0961f6085b	aizazusman4699@gmail.com	$2b$12$CvvG/mNDXMbryFeSODSSO.Cx5/AUwGhvfc07GpFhbueCO76Mqx2E.	3	t	Aizaz Usman	Aizaz	Usman	03360391371	t	1	2	2025-10-24 20:06:29.584489+05	2025-10-24 20:07:34.31+05
85f34afd-4d98-421e-9672-193adebfc6d6	aijazkhan@gmail.com	$2b$12$Iisx5NmUyPy1ghAG1lNy0eTZtZsW.vu05OMMmAewWs8vEla2p163O	2	t	Aijaz Khan	Aijaz	Khan	\N	f	4	\N	2025-12-06 17:53:08.32497+05	2025-12-06 17:53:08.32497+05
d9e48c35-2f2c-4ea2-8e59-af717a584e6d	ayan@gmail.com	$2b$12$7DWTDjfwYL95xw9MoV9QnuTKXf439Mu5LLKIwRGWMTvpF9oLSdeje	3	t	Ayan Mustafa	Ayan	Mustafa	\N	f	4	5	2025-12-06 17:54:48.820135+05	2025-12-06 17:54:48.820135+05
b3464267-3953-4f90-8e0a-503e8ec61f80	memonuzair331@gmail.com	$2b$12$waVibC3U6TZ3w3zmmfHm/OMWtrbBV5W/y3qQUSOk9pSofsYT/jr2G	3	t	Uzair Usman	Uzair	Usman	03360391371	t	1	1	2025-10-24 20:07:19.945917+05	2025-10-24 20:07:19.945917+05
15a75641-e78a-455c-8fb6-ee73cd4d9588	k224081@nu.edu.pk	$2b$12$kEZRZWvBoU9FGJf25nGaguayN9pbNgnxhjgwSkjRTk1LQgi/AMx7K	2	t	raza khan	raza	khan	\N	f	5	\N	2025-12-09 21:03:47.263127+05	2025-12-09 21:03:47.263127+05
61ef2afc-abe3-4220-bdf0-f838762b9f39	ebad@gmail.com	$2b$12$l0RSRtrUa7KK24AIwCbR2u2stlIHjstrQ2LYMa/3nP6.CARKYVdJS	2	t	ebad khan	ebad	khan	\N	f	5	\N	2025-12-15 17:18:39.529813+05	2025-12-15 17:18:39.529813+05
b4c378a6-a3a9-4cfd-955d-1561f985d8b8	saad@gmail.com	$2b$12$mSfyWvoXNii0/QhZ1wQuOOuMm0eUVsRgfHCuU83F6cde/IOm85nay	3	t	saad khan	saad	khan	\N	f	5	6	2025-12-15 17:56:56.416675+05	2025-12-17 18:30:02.766+05
d1a40f3d-12cf-479f-8180-7c1908d63473	sm@gmail.com	$2b$12$8Iik2h9FA4JeJi/nGWGI1uL26EgAL5riEp/YDlnQbYjf9u6tkN7QW	3	t	sm khan	sm	khan	03360391371	f	1	1	2025-12-17 18:39:23.221177+05	2025-12-17 18:39:23.221177+05
93e0c992-3a85-4b6e-8222-40d0792a9465	rm@gmail.com	$2b$12$nTJMEEqLDBbmOxjMkjrgQe4hDjP9ueGDmsmuJvFTn/jwqp6dnRmhS	3	t	rm khan	rm	khan	03360391371	f	2	3	2025-12-17 18:40:19.591696+05	2025-12-17 18:40:19.591696+05
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 12, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 127, true);


--
-- Name: branch_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.branch_inventory_id_seq', 1, true);


--
-- Name: branch_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.branch_products_id_seq', 1, false);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.branches_id_seq', 7, true);


--
-- Name: budgets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.budgets_id_seq', 7, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 3, true);


--
-- Name: employee_credentials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_credentials_id_seq', 3, true);


--
-- Name: global_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.global_products_id_seq', 3, true);


--
-- Name: head_offices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.head_offices_id_seq', 1, false);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_id_seq', 1, false);


--
-- Name: inventory_sync_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_sync_logs_id_seq', 1, false);


--
-- Name: modifiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.modifiers_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_id_seq', 33, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 23, true);


--
-- Name: org_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.org_metrics_id_seq', 1, false);


--
-- Name: organization_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.organization_inventory_id_seq', 16, true);


--
-- Name: organization_products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.organization_products_id_seq', 1, false);


--
-- Name: organization_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.organization_settings_id_seq', 8, true);


--
-- Name: organizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.organizations_id_seq', 5, true);


--
-- Name: product_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_assignments_id_seq', 1, false);


--
-- Name: product_import_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_import_batches_id_seq', 1, false);


--
-- Name: product_modifiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.product_modifiers_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 1, false);


--
-- Name: refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.refunds_id_seq', 5, true);


--
-- Name: restock_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.restock_requests_id_seq', 1, false);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.role_permissions_id_seq', 86, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 3, true);


--
-- Name: skus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.skus_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 1, false);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branch_inventory branch_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_pkey PRIMARY KEY (id);


--
-- Name: branch_products branch_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: employee_credentials employee_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_pkey PRIMARY KEY (id);


--
-- Name: global_products global_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_pkey PRIMARY KEY (id);


--
-- Name: head_offices head_offices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.head_offices
    ADD CONSTRAINT head_offices_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: inventory_sync_logs inventory_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_sync_logs
    ADD CONSTRAINT inventory_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: mfa_codes mfa_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mfa_codes
    ADD CONSTRAINT mfa_codes_pkey PRIMARY KEY (id);


--
-- Name: modifiers modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_tid_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tid_unique UNIQUE (tid);


--
-- Name: org_metrics org_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_metrics
    ADD CONSTRAINT org_metrics_pkey PRIMARY KEY (id);


--
-- Name: organization_inventory organization_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_pkey PRIMARY KEY (id);


--
-- Name: organization_products organization_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: product_assignments product_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_pkey PRIMARY KEY (id);


--
-- Name: product_import_batches product_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_import_batches
    ADD CONSTRAINT product_import_batches_pkey PRIMARY KEY (id);


--
-- Name: product_modifiers product_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: restock_requests restock_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: skus skus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_branch_idx ON public.audit_logs USING btree (branch_id);


--
-- Name: audit_entity_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_entity_idx ON public.audit_logs USING btree (entity);


--
-- Name: audit_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_org_idx ON public.audit_logs USING btree (organization_id);


--
-- Name: audit_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_user_idx ON public.audit_logs USING btree (user_id);


--
-- Name: branch_inventory_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_active_idx ON public.branch_inventory USING btree (is_active);


--
-- Name: branch_inventory_assigned_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_assigned_by_idx ON public.branch_inventory USING btree (assigned_by_user_id);


--
-- Name: branch_inventory_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_branch_idx ON public.branch_inventory USING btree (branch_id);


--
-- Name: branch_inventory_branch_org_inventory_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX branch_inventory_branch_org_inventory_uq ON public.branch_inventory USING btree (branch_id, organization_inventory_id);


--
-- Name: branch_inventory_deleted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_deleted_at_idx ON public.branch_inventory USING btree (deleted_at);


--
-- Name: branch_inventory_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_org_idx ON public.branch_inventory USING btree (organization_id);


--
-- Name: branch_inventory_org_inventory_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_org_inventory_idx ON public.branch_inventory USING btree (organization_inventory_id);


--
-- Name: branch_inventory_visible_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_inventory_visible_idx ON public.branch_inventory USING btree (is_visible);


--
-- Name: branch_products_available_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_available_idx ON public.branch_products USING btree (is_available);


--
-- Name: branch_products_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_branch_idx ON public.branch_products USING btree (branch_id);


--
-- Name: branch_products_branch_product_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX branch_products_branch_product_uq ON public.branch_products USING btree (branch_id, global_product_id);


--
-- Name: branch_products_global_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_global_idx ON public.branch_products USING btree (global_product_id);


--
-- Name: branch_products_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_org_idx ON public.branch_products USING btree (organization_id);


--
-- Name: branch_products_org_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_org_product_idx ON public.branch_products USING btree (organization_product_id);


--
-- Name: branch_products_visible_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branch_products_visible_idx ON public.branch_products USING btree (is_visible);


--
-- Name: branches_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branches_name_idx ON public.branches USING btree (name);


--
-- Name: branches_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branches_org_idx ON public.branches USING btree (organization_id);


--
-- Name: branches_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX branches_status_idx ON public.branches USING btree (status);


--
-- Name: budgets_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX budgets_branch_idx ON public.budgets USING btree (branch_id);


--
-- Name: budgets_branch_period_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX budgets_branch_period_uq ON public.budgets USING btree (branch_id, period);


--
-- Name: budgets_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX budgets_org_idx ON public.budgets USING btree (organization_id);


--
-- Name: categories_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_name_idx ON public.categories USING btree (name);


--
-- Name: categories_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_org_idx ON public.categories USING btree (organization_id);


--
-- Name: employee_creds_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_creds_active_idx ON public.employee_credentials USING btree (is_active);


--
-- Name: employee_creds_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_creds_branch_idx ON public.employee_credentials USING btree (branch_id);


--
-- Name: employee_creds_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_creds_created_by_idx ON public.employee_credentials USING btree (created_by_user_id);


--
-- Name: employee_creds_email_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employee_creds_email_uq ON public.employee_credentials USING btree (email);


--
-- Name: employee_creds_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX employee_creds_org_idx ON public.employee_credentials USING btree (organization_id);


--
-- Name: global_products_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX global_products_category_idx ON public.global_products USING btree (category_id);


--
-- Name: global_products_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX global_products_code_idx ON public.global_products USING btree (product_code);


--
-- Name: global_products_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX global_products_name_idx ON public.global_products USING btree (name);


--
-- Name: global_products_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX global_products_status_idx ON public.global_products USING btree (status);


--
-- Name: head_offices_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX head_offices_org_idx ON public.head_offices USING btree (organization_id);


--
-- Name: inventory_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_branch_idx ON public.inventory USING btree (branch_id);


--
-- Name: inventory_branch_sku_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX inventory_branch_sku_uq ON public.inventory USING btree (branch_id, sku_id);


--
-- Name: inventory_org_branch_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_org_branch_sku_idx ON public.inventory USING btree (organization_id, branch_id, sku_id);


--
-- Name: inventory_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_org_idx ON public.inventory USING btree (organization_id);


--
-- Name: inventory_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_sync_logs_started_at_idx ON public.inventory_sync_logs USING btree (started_at);


--
-- Name: inventory_sync_logs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_sync_logs_status_idx ON public.inventory_sync_logs USING btree (status);


--
-- Name: inventory_sync_logs_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_sync_logs_target_idx ON public.inventory_sync_logs USING btree (target_type, target_id);


--
-- Name: inventory_sync_logs_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_sync_logs_type_idx ON public.inventory_sync_logs USING btree (sync_type);


--
-- Name: inventory_sync_logs_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX inventory_sync_logs_user_idx ON public.inventory_sync_logs USING btree (performed_by_user_id);


--
-- Name: mfa_codes_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mfa_codes_code_idx ON public.mfa_codes USING btree (code);


--
-- Name: mfa_codes_expires_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mfa_codes_expires_idx ON public.mfa_codes USING btree (expires_at);


--
-- Name: mfa_codes_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mfa_codes_type_idx ON public.mfa_codes USING btree (type);


--
-- Name: mfa_codes_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mfa_codes_user_idx ON public.mfa_codes USING btree (user_id);


--
-- Name: modifiers_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modifiers_name_idx ON public.modifiers USING btree (name);


--
-- Name: modifiers_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modifiers_status_idx ON public.modifiers USING btree (status);


--
-- Name: modifiers_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modifiers_type_idx ON public.modifiers USING btree (type);


--
-- Name: modifiers_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX modifiers_user_idx ON public.modifiers USING btree (created_by_user_id);


--
-- Name: notifications_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_branch_idx ON public.notifications USING btree (branch_id);


--
-- Name: notifications_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_org_idx ON public.notifications USING btree (organization_id);


--
-- Name: notifications_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_type_idx ON public.notifications USING btree (type);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id);


--
-- Name: order_items_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);


--
-- Name: order_items_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_items_org_idx ON public.order_items USING btree (organization_id);


--
-- Name: order_items_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX order_items_product_idx ON public.order_items USING btree (global_product_id);


--
-- Name: orders_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_branch_idx ON public.orders USING btree (branch_id);


--
-- Name: orders_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_created_idx ON public.orders USING btree (created_at);


--
-- Name: orders_org_branch_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_org_branch_status_idx ON public.orders USING btree (organization_id, branch_id, status);


--
-- Name: orders_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_org_idx ON public.orders USING btree (organization_id);


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: orders_tid_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX orders_tid_idx ON public.orders USING btree (tid);


--
-- Name: org_inventory_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_inventory_active_idx ON public.organization_inventory USING btree (is_active);


--
-- Name: org_inventory_assigned_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_inventory_assigned_by_idx ON public.organization_inventory USING btree (assigned_by_user_id);


--
-- Name: org_inventory_deleted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_inventory_deleted_at_idx ON public.organization_inventory USING btree (deleted_at);


--
-- Name: org_inventory_global_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_inventory_global_product_idx ON public.organization_inventory USING btree (global_product_id);


--
-- Name: org_inventory_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_inventory_org_idx ON public.organization_inventory USING btree (organization_id);


--
-- Name: org_inventory_org_product_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX org_inventory_org_product_uq ON public.organization_inventory USING btree (organization_id, global_product_id);


--
-- Name: org_metrics_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_metrics_org_idx ON public.org_metrics USING btree (organization_id);


--
-- Name: org_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX org_name_idx ON public.organizations USING btree (name);


--
-- Name: org_products_enabled_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_products_enabled_idx ON public.organization_products USING btree (is_enabled);


--
-- Name: org_products_global_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_products_global_idx ON public.organization_products USING btree (global_product_id);


--
-- Name: org_products_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_products_org_idx ON public.organization_products USING btree (organization_id);


--
-- Name: org_products_org_product_uq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX org_products_org_product_uq ON public.organization_products USING btree (organization_id, global_product_id);


--
-- Name: org_settings_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_settings_org_idx ON public.organization_settings USING btree (organization_id);


--
-- Name: org_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_status_idx ON public.organizations USING btree (status);


--
-- Name: product_assignments_assigned_to_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_assignments_assigned_to_idx ON public.product_assignments USING btree (assigned_to_type, assigned_to_id);


--
-- Name: product_assignments_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_assignments_product_idx ON public.product_assignments USING btree (global_product_id);


--
-- Name: product_assignments_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_assignments_user_idx ON public.product_assignments USING btree (performed_by_user_id);


--
-- Name: product_import_batches_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_import_batches_created_at_idx ON public.product_import_batches USING btree (created_at);


--
-- Name: product_import_batches_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_import_batches_status_idx ON public.product_import_batches USING btree (status);


--
-- Name: product_import_batches_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_import_batches_user_idx ON public.product_import_batches USING btree (uploaded_by_user_id);


--
-- Name: product_modifiers_modifier_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_modifiers_modifier_idx ON public.product_modifiers USING btree (modifier_id);


--
-- Name: product_modifiers_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX product_modifiers_product_idx ON public.product_modifiers USING btree (product_id);


--
-- Name: product_modifiers_product_modifier_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX product_modifiers_product_modifier_idx ON public.product_modifiers USING btree (product_id, modifier_id);


--
-- Name: products_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_idx ON public.products USING btree (category_id);


--
-- Name: products_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_idx ON public.products USING btree (name);


--
-- Name: products_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_org_idx ON public.products USING btree (organization_id);


--
-- Name: refunds_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refunds_order_idx ON public.refunds USING btree (order_id);


--
-- Name: refunds_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refunds_org_idx ON public.refunds USING btree (organization_id);


--
-- Name: refunds_processed_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refunds_processed_by_idx ON public.refunds USING btree (processed_by_user_id);


--
-- Name: restock_requests_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX restock_requests_branch_idx ON public.restock_requests USING btree (branch_id);


--
-- Name: restock_requests_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX restock_requests_org_idx ON public.restock_requests USING btree (organization_id);


--
-- Name: restock_requests_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX restock_requests_product_idx ON public.restock_requests USING btree (global_product_id);


--
-- Name: restock_requests_requested_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX restock_requests_requested_by_idx ON public.restock_requests USING btree (requested_by_user_id);


--
-- Name: restock_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX restock_requests_status_idx ON public.restock_requests USING btree (status);


--
-- Name: role_permissions_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_permissions_role_idx ON public.role_permissions USING btree (role_id);


--
-- Name: roles_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_idx ON public.roles USING btree (name);


--
-- Name: sessions_expires_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_expires_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_org_idx ON public.sessions USING btree (organization_id);


--
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);


--
-- Name: skus_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX skus_org_idx ON public.skus USING btree (organization_id);


--
-- Name: skus_product_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX skus_product_idx ON public.skus USING btree (product_id);


--
-- Name: skus_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX skus_sku_idx ON public.skus USING btree (sku);


--
-- Name: suppliers_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_branch_idx ON public.suppliers USING btree (branch_id);


--
-- Name: suppliers_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_name_idx ON public.suppliers USING btree (name);


--
-- Name: suppliers_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_org_idx ON public.suppliers USING btree (organization_id);


--
-- Name: users_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_active_idx ON public.users USING btree (is_active);


--
-- Name: users_branch_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_branch_idx ON public.users USING btree (branch_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_org_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_org_idx ON public.users USING btree (organization_id);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_role_idx ON public.users USING btree (role_id);


--
-- Name: audit_logs audit_logs_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: audit_logs audit_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: branch_inventory branch_inventory_assigned_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_assigned_by_user_id_users_id_fk FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id);


--
-- Name: branch_inventory branch_inventory_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_inventory branch_inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: branch_inventory branch_inventory_organization_inventory_id_organization_invento; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_inventory
    ADD CONSTRAINT branch_inventory_organization_inventory_id_organization_invento FOREIGN KEY (organization_inventory_id) REFERENCES public.organization_inventory(id) ON DELETE CASCADE;


--
-- Name: branch_products branch_products_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_products branch_products_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: branch_products branch_products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: branch_products branch_products_organization_product_id_organization_products_i; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_organization_product_id_organization_products_i FOREIGN KEY (organization_product_id) REFERENCES public.organization_products(id) ON DELETE CASCADE;


--
-- Name: branch_products branch_products_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_products
    ADD CONSTRAINT branch_products_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: branches branches_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: budgets budgets_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: budgets budgets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: categories categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: employee_credentials employee_credentials_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: employee_credentials employee_credentials_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: employee_credentials employee_credentials_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_credentials
    ADD CONSTRAINT employee_credentials_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: global_products global_products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: global_products global_products_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_products
    ADD CONSTRAINT global_products_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: head_offices head_offices_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.head_offices
    ADD CONSTRAINT head_offices_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory inventory_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: inventory inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: inventory inventory_sku_id_skus_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_sku_id_skus_id_fk FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: inventory_sync_logs inventory_sync_logs_performed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_sync_logs
    ADD CONSTRAINT inventory_sync_logs_performed_by_user_id_users_id_fk FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- Name: mfa_codes mfa_codes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mfa_codes
    ADD CONSTRAINT mfa_codes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: modifiers modifiers_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: notifications notifications_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: order_items order_items_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: orders orders_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: orders orders_created_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_user_id_users_id_fk FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: orders orders_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: org_metrics org_metrics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.org_metrics
    ADD CONSTRAINT org_metrics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_inventory organization_inventory_assigned_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_assigned_by_user_id_users_id_fk FOREIGN KEY (assigned_by_user_id) REFERENCES public.users(id);


--
-- Name: organization_inventory organization_inventory_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: organization_inventory organization_inventory_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_inventory
    ADD CONSTRAINT organization_inventory_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_products organization_products_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: organization_products organization_products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_products organization_products_updated_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_products
    ADD CONSTRAINT organization_products_updated_by_user_id_users_id_fk FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: organization_settings organization_settings_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: product_assignments product_assignments_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: product_assignments product_assignments_performed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_assignments
    ADD CONSTRAINT product_assignments_performed_by_user_id_users_id_fk FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- Name: product_import_batches product_import_batches_uploaded_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_import_batches
    ADD CONSTRAINT product_import_batches_uploaded_by_user_id_users_id_fk FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id);


--
-- Name: product_modifiers product_modifiers_modifier_id_modifiers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_modifier_id_modifiers_id_fk FOREIGN KEY (modifier_id) REFERENCES public.modifiers(id);


--
-- Name: product_modifiers product_modifiers_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_modifiers
    ADD CONSTRAINT product_modifiers_product_id_global_products_id_fk FOREIGN KEY (product_id) REFERENCES public.global_products(id);


--
-- Name: products products_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: refunds refunds_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: refunds refunds_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: refunds refunds_processed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_processed_by_user_id_users_id_fk FOREIGN KEY (processed_by_user_id) REFERENCES public.users(id);


--
-- Name: refunds refunds_requested_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: refunds refunds_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: restock_requests restock_requests_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: restock_requests restock_requests_global_product_id_global_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_global_product_id_global_products_id_fk FOREIGN KEY (global_product_id) REFERENCES public.global_products(id);


--
-- Name: restock_requests restock_requests_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: restock_requests restock_requests_requested_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_requested_by_user_id_users_id_fk FOREIGN KEY (requested_by_user_id) REFERENCES public.users(id);


--
-- Name: restock_requests restock_requests_reviewed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.restock_requests
    ADD CONSTRAINT restock_requests_reviewed_by_user_id_users_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id);


--
-- Name: role_permissions role_permissions_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: sessions sessions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: skus skus_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: skus skus_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: suppliers suppliers_branch_id_branches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_branch_id_branches_id_fk FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: suppliers suppliers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: users users_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 7zQNonuiwcN4ezvsipnkuIj9hEbFXeABrO6orzIJ8fb25Zz3Pp8iPEZNGarmGcw

