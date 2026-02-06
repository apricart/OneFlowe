-- Fix groups unique constraint to allow recreating groups with same name after deletion
-- Drop the old unique index
DROP INDEX IF EXISTS "groups_org_name_uq";

-- Create a partial unique index that only enforces uniqueness for non-deleted groups
CREATE UNIQUE INDEX "groups_org_name_active_uq" 
ON "groups" ("organization_id", "name") 
WHERE ("status" IS DISTINCT FROM 'deleted');
