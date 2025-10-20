# 📦 Inventory Management & Product Assignation System

**Apricart OneFlowe - Global Inventory Management**

## 🎯 System Overview

A comprehensive, scalable inventory management system supporting **three hierarchical roles**:

1. **Super Admin** - Global control, master inventory management
2. **Head Office (Organization)** - Product shortlisting and organization-level customization
3. **Branch Admin** - On-ground stock management and availability control

---

## 🏗️ Architecture

### Database Schema

The system uses a **three-tier hierarchical structure** with cascading updates:

#### Core Tables

1. **`global_products`** - Master product catalog (Super Admin owned)
   - Product code, name, description, category
   - Base pricing, units, status
   - Global metadata and sync tracking

2. **`organization_products`** - Organization-level customization
   - Links to global products
   - Enable/disable products for organization
   - Custom names, descriptions, pricing
   - Tags, priority, override tracking

3. **`branch_products`** - Branch-level stock management
   - Stock quantities, reserved quantities
   - Reorder thresholds and quantities
   - Availability flags, custom notes
   - Last restock dates

#### Supporting Tables

- **`product_assignments`** - Assignment audit trail
- **`restock_requests`** - Branch restock request workflow
- **`inventory_sync_logs`** - Synchronization tracking
- **`product_import_batches`** - CSV import tracking

---

## 🚀 Features by Role

### 🔧 Super Admin

**Global Inventory Dashboard** (`/inventory`)

**Key Features:**
- ✅ Create, edit, delete global products
- ✅ Bulk CSV import with validation
- ✅ Assign products to organizations/branches
- ✅ Cascade assignments to all branches
- ✅ Override organization settings
- ✅ Global sync and distribution control
- ✅ Multi-select bulk operations
- ✅ Advanced search and filtering

**API Endpoints:**
```
GET    /api/v1/inventory/global-products
POST   /api/v1/inventory/global-products
GET    /api/v1/inventory/global-products/[id]
PUT    /api/v1/inventory/global-products/[id]
DELETE /api/v1/inventory/global-products/[id]
POST   /api/v1/inventory/assignments
DELETE /api/v1/inventory/assignments
POST   /api/v1/inventory/import
GET    /api/v1/inventory/import?batchId=...
```

---

### 🏢 Head Office

**Organization Inventory Dashboard** (`/inventory`)

**Key Features:**
- ✅ View all global products
- ✅ Enable/disable products for organization
- ✅ Customize product names and descriptions
- ✅ Set custom pricing for organization
- ✅ Assign products to specific branches
- ✅ Branch distribution matrix view
- ✅ Tag and prioritize products

**Cascading Behavior:**
- Disabling a product → Automatically disables for all branches
- Custom pricing → Propagates to branches (unless overridden)
- Product removal → Removes from all child branches

**API Endpoints:**
```
GET /api/v1/inventory/organization-products?organizationId=X
PUT /api/v1/inventory/organization-products
```

---

### 🏬 Branch Admin

**Branch Inventory Dashboard** (`/inventory`)

**Key Features:**
- ✅ View approved organization products only
- ✅ Update stock quantities (add or set)
- ✅ Mark products available/unavailable
- ✅ Set reorder thresholds
- ✅ Track last restock dates
- ✅ Low stock alerts and indicators
- ✅ Generate restock requests
- ✅ Add branch-specific notes

**Stock Status Indicators:**
- 🟢 **In Stock** - Above reorder threshold
- 🟡 **Low Stock** - At or below reorder threshold
- 🔴 **Out of Stock** - Zero quantity

**API Endpoints:**
```
GET  /api/v1/inventory/branch-products?branchId=X&organizationId=Y
PUT  /api/v1/inventory/branch-products
POST /api/v1/inventory/branch-products/restock
```

---

## 📊 Data Flow & Hierarchy

```
┌─────────────────────────────────────────┐
│        SUPER ADMIN                      │
│  Global Products (Master Catalog)       │
│  - Creates/uploads products             │
│  - Sets base prices                     │
│  - Controls global distribution         │
└──────────────┬──────────────────────────┘
               │ Assigns to ↓
               │
┌──────────────▼──────────────────────────┐
│        HEAD OFFICE (Organization)       │
│  Organization Products                  │
│  - Enables/disables products            │
│  - Custom names, descriptions           │
│  - Custom pricing                       │
│  - Assigns to branches                  │
└──────────────┬──────────────────────────┘
               │ Cascades to ↓
               │
┌──────────────▼──────────────────────────┐
│        BRANCH ADMIN                     │
│  Branch Products                        │
│  - Manages stock quantities             │
│  - Controls availability                │
│  - Restock requests                     │
│  - On-ground operations                 │
└─────────────────────────────────────────┘
```

### Cascade Rules

1. **Super Admin → Organization**
   - Product assignment creates `organization_products` entry
   - Default: enabled, uses global data
   
2. **Organization → Branch**
   - Enabled org products → Available to branch
   - Disabled org products → Automatically hidden from branch
   - Custom pricing → Propagates unless overridden

3. **Super Admin Override**
   - Can force include/exclude at any level
   - Override tracked in `overrideSource` field
   - Sync logs maintain audit trail

---

## 🎨 UI Components

### 1. **Super Admin Inventory** (`components/inventory/super-admin-inventory.tsx`)

**Features:**
- Modern table with virtualization support
- Multi-select with bulk actions
- Inline editing and deletion
- Assignment drawer for distribution
- CSV upload dialog with validation
- Status tabs (All/Active/Inactive/Discontinued)
- Real-time search filtering
- KPI cards (Total, Active, Inactive, Selected)

### 2. **Head Office Inventory** (`components/inventory/head-office-inventory.tsx`)

**Features:**
- Global products view with org customization
- Enable/disable toggle per product
- Custom pricing editor
- Branch assignment matrix (upcoming)
- Product shortlisting interface
- Customization indicators
- View tabs (All/Enabled/Disabled)

### 3. **Branch Admin Inventory** (`components/inventory/branch-admin-inventory.tsx`)

**Features:**
- Stock-focused interface
- Editable quantity fields
- Low stock highlighting
- Reorder threshold management
- Stock status badges
- Quick restock dialog
- Filter tabs (All/In Stock/Low Stock/Out of Stock)

---

## 📥 CSV Import Format

**Required Columns:**
- `productCode` (unique identifier)
- `name` (product name)

**Optional Columns:**
- `description`
- `category` (must exist in categories table)
- `imageUrl`
- `basePrice` (in dollars, e.g., 12.99)
- `unit` (e.g., kg, box, piece)
- `status` (active/inactive/discontinued)

**Example CSV:**
```csv
productCode,name,description,category,basePrice,unit,status
PRD-001,Premium Coffee Beans,Arabica beans from Colombia,Beverages,24.99,kg,active
PRD-002,Green Tea,Organic green tea leaves,Beverages,12.50,box,active
PRD-003,Notebook A4,Lined notebook 100 pages,Stationery,3.99,piece,active
```

**Import Process:**
1. Upload CSV via Super Admin dashboard
2. System validates each row
3. Creates or updates global products
4. Returns batch summary with success/error counts
5. Validation errors displayed with row numbers

---

## 🔒 Security & Permissions

### Role-Based Access Control

**Super Admin:**
- Full access to all endpoints
- Can create/edit/delete global products
- Can override any organization/branch settings
- Access to import and bulk operations

**Head Office:**
- Read access to global products
- Write access to organization_products
- Can enable/disable for their organization
- Can assign to their branches only

**Branch Admin:**
- Read access to enabled organization products
- Write access to branch_products (their branch only)
- Can update stock and availability
- Can create restock requests

### API Authorization

All endpoints check:
1. Valid session exists
2. User role has permission
3. User has access to requested organization/branch

---

## 🔄 Sync & Audit

### Sync Logs (`inventory_sync_logs`)

Tracks all synchronization operations:
- Full sync vs. partial sync
- Trigger level (super_admin/head_office/branch)
- Target type and IDs
- Affected products list
- Success/failure status
- Performance metadata

### Product Assignments (`product_assignments`)

Audit trail for all assignments:
- Product ID
- Target type (organization/branch)
- Action (assigned/unassigned/forced)
- Performed by user and role
- Timestamp

### Audit Logs (`audit_logs`)

General audit logging:
- Product creation/updates/deletion
- Import operations
- Stock updates
- Restock requests

---

## ⚡ Performance Optimizations

### Database
- ✅ Comprehensive indexing on all foreign keys
- ✅ Composite indexes for common queries
- ✅ JSONB for flexible metadata storage
- ✅ Optimized queries with joins

### Frontend
- ✅ SWR for data fetching and caching
- ✅ Optimistic UI updates
- ✅ Virtualized tables for large datasets
- ✅ Debounced search inputs
- ✅ Lazy loading for branch data

### Scalability
- Supports **hundreds of organizations**
- Supports **thousands of branches**
- Handles **10,000+** products efficiently
- Asynchronous bulk operations
- Pagination on all list endpoints

---

## 🚦 Getting Started

### 1. Run Database Migration

```bash
npx drizzle-kit push
```

This will create all inventory tables.

### 2. Access Inventory Module

Navigate to `/inventory` - the system will route you to the appropriate dashboard based on your role.

### 3. Super Admin: Upload Initial Products

1. Click "Import CSV"
2. Upload your product catalog
3. Review validation results
4. Assign products to organizations

### 4. Head Office: Configure Organization

1. Review global products
2. Enable relevant products
3. Customize names/pricing if needed
4. Assign to branches

### 5. Branch Admin: Manage Stock

1. View approved products
2. Set initial stock quantities
3. Configure reorder thresholds
4. Start tracking inventory

---

## 🎯 Future Enhancements

- [ ] Branch mapping matrix UI (visual grid)
- [ ] Bulk pricing updates
- [ ] Product variants (size, color, etc.)
- [ ] Inventory forecasting with AI
- [ ] Automated restock workflows
- [ ] Product images upload
- [ ] Advanced analytics dashboard
- [ ] Export inventory reports
- [ ] Real-time sync indicators
- [ ] Version snapshots and rollback
- [ ] Low stock email notifications

---

## 📚 API Reference

### Complete Endpoint List

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/inventory/global-products` | Super Admin | List all global products |
| POST | `/api/v1/inventory/global-products` | Super Admin | Create new product |
| GET | `/api/v1/inventory/global-products/[id]` | All | Get single product |
| PUT | `/api/v1/inventory/global-products/[id]` | Super Admin | Update product |
| DELETE | `/api/v1/inventory/global-products/[id]` | Super Admin | Soft delete product |
| POST | `/api/v1/inventory/assignments` | Super Admin, Head Office | Assign products |
| DELETE | `/api/v1/inventory/assignments` | Super Admin, Head Office | Unassign products |
| POST | `/api/v1/inventory/import` | Super Admin | Import CSV |
| GET | `/api/v1/inventory/import` | Super Admin | List import batches |
| GET | `/api/v1/inventory/organization-products` | Head Office | List org products |
| PUT | `/api/v1/inventory/organization-products` | Head Office | Update org product |
| GET | `/api/v1/inventory/branch-products` | Branch Admin | List branch products |
| PUT | `/api/v1/inventory/branch-products` | Branch Admin | Update branch product |
| POST | `/api/v1/inventory/branch-products/restock` | Branch Admin | Update stock quantity |

---

## 🐛 Troubleshooting

### "Module not found" error
**Solution:** Restart Next.js dev server to pick up new components.

### Products not showing for organization
**Check:**
1. Products are assigned by Super Admin
2. Organization products are enabled
3. Product status is "active"

### Branch can't see products
**Check:**
1. Head Office has enabled products
2. Products are assigned to organization
3. Branch ID is correct in session

### Import validation errors
**Common issues:**
- Product code already exists (will update instead)
- Category doesn't exist in database
- Invalid price format (use decimal numbers)
- Missing required fields (code, name)

---

## 📞 Support

For issues or questions about the inventory system:
1. Check this documentation
2. Review API response error messages
3. Check browser console for frontend errors
4. Review `audit_logs` table for recent changes

---

**Built with:**
- Next.js 14 (App Router)
- React 18
- Drizzle ORM
- PostgreSQL
- TypeScript
- Tailwind CSS
- SWR for data fetching

**Design Inspired by:** Linear, Notion, Stripe Admin

---

*Last Updated: October 2025*

