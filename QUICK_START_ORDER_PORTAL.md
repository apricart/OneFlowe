# 🛒 Order Portal - Quick Start Guide

## What's New?

Your system now has a **separate, beautiful Order Portal** where branch employees can:
- 🎨 Browse products with modern e-commerce UI
- 🔍 Search and filter products
- 🛒 Add items to cart and checkout
- 💰 See their remaining budget in real-time
- 📦 Track order status

## 🚀 Getting Started

### For Branch Admins

#### Step 1: Create Employee Credentials
1. Log in to Dashboard: `/auth/login` (with your admin account)
2. Go to **Settings** → **Employee Portal Access**
3. Click **"Add Employee"** button
4. Fill in:
   - Email (must be unique)
   - Password (or generate one, then copy)
   - First Name
   - Last Name (optional)
   - Enable MFA (optional checkbox)
5. Click **"Create"**

#### Step 2: Share with Employee
- Share the email and password with your employee
- If MFA is enabled, walk through TOTP setup

### For Employees

#### Step 1: Access Portal
1. Go to `/shop/login` (or click "Order Portal Login" on main login page)
2. Enter the email and password provided by Branch Admin

#### Step 2: Set Up MFA (if enabled)
- Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
- Enter 6-digit code when prompted

#### Step 3: Browse & Order
1. **Find Products**: Search by name or code, use filters
2. **View Details**: See price, stock status, ratings
3. **Add to Cart**: Click "Add to Cart" button
4. **Review Cart**: Click "Cart" button to see items
5. **Check Budget**: See remaining budget at top
6. **Checkout**: Click "Proceed to Checkout"
7. **Review Order**: Check items and total
8. **Place Order**: Click "Place Order"
9. **Get TID**: Note your Transaction ID for tracking

#### Step 4: Track Status
- Orders appear in your order list
- Status updates as admin approves/fulfills
- Employee can see order history

## 📊 For Dashboard Users (Approvals)

### View Employee Orders
1. Log in to Dashboard: `/auth/login`
2. Go to **Orders** section
3. Filter by status (Pending, Approved, etc.)
4. See which employee placed each order

### Approve/Fulfill Orders
1. Click on order from employee
2. Available actions:
   - **Pending** → Approve or Reject
   - **Approved** → Fulfill
   - **Fulfilled** → Issue Refund

### Process Refund
1. Click order details
2. Click **"Refund"** button
3. Enter refund amount
4. Add optional reason
5. Employee's budget credited

## 🏗️ System Architecture

```
┌─────────────────────────────────┐
│   MAIN LOGIN (/auth/login)      │
│                                 │
│  [Dashboard Login] [Portal →]   │  ← "Order Portal Login" button
└─────────────────────────────────┘
         ↓
    ┌────────────────────────────────────────┐
    │                                        │
    ↓                                        ↓
┌──────────────────────┐          ┌──────────────────────┐
│   DASHBOARD          │          │   PORTAL (/shop)     │
│   (/auth/login)      │          │   (/shop/login)      │
│                      │          │                      │
│ • Admins             │          │ • Employees          │
│ • Head Office        │          │ • Order placement    │
│ • Approvals          │          │ • Ecommerce UI       │
│ • Budget mgmt        │          │ • Cart               │
│ • Order mgmt         │          │ • Budget display     │
└──────────────────────┘          └──────────────────────┘
         ↑                                   ↑
         │                                   │
      Users                     EmployeeCredentials
      (Dashboard)               (Portal only)
```

## 🔐 Security Features

✅ **Separate Authentication**
- Dashboard users ≠ Portal employees
- Each has own login flow

✅ **Password Security**
- Bcrypt hashed (no plaintext storage)
- Unique per employee

✅ **MFA Support**
- Optional two-factor authentication
- Same TOTP system as dashboard

✅ **Budget Enforcement**
- Automatic validation at checkout
- Can't exceed branch allocation

✅ **Audit Logging**
- Every order tracked to employee
- Visible in dashboard audit logs

✅ **Branch Isolation**
- Employees see only their branch inventory
- Can't access other branches

## 📍 Key URLs

| URL | Purpose | Access |
|-----|---------|--------|
| `/auth/login` | Dashboard login | Admin, Head Office, Super Admin |
| `/shop/login` | Portal login | Employees |
| `/shop` | Order portal | Employees (authenticated) |
| `/(portal)/settings` | Employee management | Branch Admin |
| `/(portal)/orders` | Order approvals | All dashboard users |
| `/(portal)/dashboard` | Overview | All dashboard users |

## 💡 Tips & Tricks

### For Branch Admins
- 🔄 **Generate Passwords**: Click copy icon to auto-generate and copy password
- 📧 **Bulk Create**: Create multiple employees with unique emails
- 🔒 **MFA Best Practice**: Enable MFA for sensitive branches
- 🗑️ **Deactivate**: Soft-delete employees (they can't login)
- ✏️ **Edit**: Update names or MFA settings anytime

### For Employees
- 🔍 **Search**: Type product name or code to find quickly
- 📊 **Sort**: Sort by price to find best deals
- 🛒 **Cart Persistence**: Cart stays while browsing
- ⚠️ **Budget Alert**: Red warning if you exceed budget
- 📦 **Stock Check**: Low stock badge shows availability

### For Admins Reviewing Orders
- 🔀 **Filter**: View pending, approved, or rejected orders
- 📝 **Details**: Click order to see all items and quantities
- ✅ **Bulk Actions**: Approve multiple orders
- 💳 **Refunds**: Easy refund with amount and reason
- 📊 **Analytics**: Track employee spending patterns

## ⚠️ Common Issues

### "Employee Cannot Login"
- ✅ Check email in Employee Portal Access (Settings)
- ✅ Verify employee is **Active** (not deactivated)
- ✅ Confirm password is correct
- ✅ Check if MFA is enabled (need OTP)

### "Budget Exceeded"
- ✅ Check remaining budget in portal top bar
- ✅ Remove items from cart to reduce total
- ✅ Wait for pending order approvals (hold budget)

### "Order Not Appearing"
- ✅ Refresh dashboard
- ✅ Check correct branch is selected
- ✅ Verify order was actually placed (check confirmation)

### "Can't Find Product"
- ✅ Product might not be assigned to branch
- ✅ Try searching by product code instead of name
- ✅ Check if product is marked as visible

## 📞 Support

If you encounter issues:
1. Check the **Audit Log** in dashboard (Settings → Audit)
2. Look for error messages in order details
3. Verify user roles and permissions
4. Check budget allocation for branch

## 🎓 Next Steps

1. **Create a test employee** in Settings
2. **Log in as that employee** at `/shop/login`
3. **Place a test order** in the portal
4. **Approve the order** in the dashboard
5. **Check audit logs** to see tracking

---

**Portal Status:** ✅ Ready to use
**MFA Support:** ✅ Enabled
**Budget Enforcement:** ✅ Automatic
**Audit Logging:** ✅ Complete
