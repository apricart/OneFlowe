# 🛡️ Super Admin Dashboard - Complete Guide

> Modern admin interface for managing permissions, settings, and system configuration

---

## 🚀 Quick Start

### 1. Seed Database
```bash
npm run db:seed
```

This will create:
- ✅ Super Admin user
- ✅ All roles (Super Admin, Head Office, Branch Admin)
- ✅ Role permissions (49 total)
- ✅ Organization settings (8 defaults)

### 2. Access Dashboard
- **URL**: http://localhost:3000/admin
- **Login**: admin@example.com / admin123 (from .env.local)
- **Shortcut**: Press `Ctrl+K` and type "admin"

---

## ✨ Features

### **Command Palette** (Ctrl+K / ⌘K)
- Quick navigation to any module
- Switch organizations/branches
- Search everything
- Keyboard-driven workflow

### **Role Permissions** (63 permissions, 8 categories)
- System Administration
- Organization Management
- User Management
- Inventory Management
- Order Management
- Financial Operations
- Reports & Analytics
- Settings & Configuration

### **Organization Settings** (10+ predefined)
- Currency, Tax, MFA
- Session timeouts
- Order approvals
- Notifications
- Custom settings support

### **Audit Logs**
- Complete activity trail
- Filter by entity/action
- CSV export
- User attribution

### **Modern UI**
- Dark mode toggle
- Notifications bell
- Context switchers
- Responsive design

---

## 📖 Common Tasks

### Apply Permission Template
```
1. Admin Control → Permissions
2. Select role
3. Click "Apply [Role] Template"
4. Save Changes
```

### Configure Setting
```
1. Admin Control → Settings
2. Select organization
3. Toggle or edit value
4. Auto-saves (toggles) or click save
```

### Review Activity
```
1. Admin Control → Audit Logs
2. Filter as needed
3. Export CSV if needed
```

---

## 🎯 Keyboard Shortcuts

- `Ctrl+K` - Command palette
- `Tab` - Navigate fields
- `Esc` - Close dialogs
- Arrow keys - Navigate lists

---

## 🔐 Security

- Super Admin role required
- All changes logged
- High-risk permission warnings
- User attribution tracking

---

## 🛠️ Troubleshooting

**Changes not saving?**
- Check browser console
- Verify super admin role
- Check network requests

**Permissions not loading?**
- Run `npm run db:seed`
- Clear browser cache
- Check database connection

**Can't access admin panel?**
- Verify SUPER_ADMIN role in database
- Log out and back in
- Check session validity

---

## 📊 Permission System

### Super Admin (49 permissions)
Full system access - all permissions

### Head Office (24 permissions)
Organization management, users, orders, budgets, reports

### Branch Admin (14 permissions)
Inventory, orders, suppliers, branch reports

---

## 🎨 UI Components

### Top Bar
- Organization/Branch switchers
- Command palette (Ctrl+K)
- Notifications
- Theme toggle
- Profile menu

### Admin Tabs
- **Permissions** - Role management
- **Settings** - Organization config
- **Audit Logs** - Activity tracking
- **Analytics** - System metrics

---

## 🔧 Technical Details

### Files
```
lib/
├── permissions.ts          # 63 permissions
└── seed.ts                 # Unified seeding

app/api/v1/
├── roles/permissions/      # Permission API
├── settings/               # Settings API
└── audit-logs/             # Audit API

components/
├── admin/                  # Admin UI components
├── ui/command-palette.tsx  # Ctrl+K interface
└── ui/context-switcher.tsx # Org/Branch selector
```

### Database Tables
- `roles` - Role definitions
- `role_permissions` - Permission assignments
- `organization_settings` - Organization configs
- `audit_logs` - Activity tracking

---

## 📞 Need Help?

- Check browser console (F12)
- Review database with `npm run db:studio`
- Verify environment variables in `.env.local`
- Re-run `npm run db:seed` if needed

---

**Built with ❤️ for Apricart OneFlowe**

