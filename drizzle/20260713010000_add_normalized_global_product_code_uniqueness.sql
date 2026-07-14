-- Product codes are global identifiers. Protect active products from codes that
-- differ only by letter case or surrounding whitespace while continuing to
-- allow a code to be reused after its former product has been soft-deleted.
--
-- The preflight makes existing data conflicts explicit. It changes no data;
-- PostgreSQL will abort this migration before creating the index if conflicts
-- exist. CREATE UNIQUE INDEX also rechecks uniqueness while building the index.
DO $$
DECLARE
	duplicate_group_count bigint;
	duplicate_examples text;
BEGIN
	SELECT count(*)
	INTO duplicate_group_count
	FROM (
		SELECT lower(btrim("product_code")) AS normalized_code
		FROM "global_products"
		WHERE "deleted_at" IS NULL
		GROUP BY lower(btrim("product_code"))
		HAVING count(*) > 1
	) AS duplicate_groups;

	IF duplicate_group_count > 0 THEN
		SELECT string_agg(
			format('%s (ids: %s)', normalized_code, product_ids),
			'; ' ORDER BY normalized_code
		)
		INTO duplicate_examples
		FROM (
			SELECT
				lower(btrim("product_code")) AS normalized_code,
				array_agg("id" ORDER BY "id")::text AS product_ids
			FROM "global_products"
			WHERE "deleted_at" IS NULL
			GROUP BY lower(btrim("product_code"))
			HAVING count(*) > 1
			ORDER BY normalized_code
			LIMIT 10
		) AS examples;

		RAISE EXCEPTION
			USING ERRCODE = '23505',
			MESSAGE = format(
				'Cannot enforce normalized active product-code uniqueness: %s duplicate group(s) exist.',
				duplicate_group_count
			),
			DETAIL = format('Examples: %s', coalesce(duplicate_examples, '(unavailable)')),
			HINT = 'Resolve duplicate LOWER(BTRIM(product_code)) values on non-deleted global products, then retry the migration.';
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "global_products_code_active_normalized_uq"
	ON "global_products" USING btree (lower(btrim("product_code")))
	WHERE "deleted_at" IS NULL;

-- Rollback (if intentionally required):
-- DROP INDEX IF EXISTS "global_products_code_active_normalized_uq";
-- The existing "global_products_code_idx" lookup index is intentionally left
-- unchanged for compatibility with exact product-code queries.
