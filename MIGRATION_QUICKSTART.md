# Multi-Tenant Migration - Quick Start

Your distribution management system has been adapted for **multi-tenant architecture**. This allows multiple organizations to use the same application with complete data isolation.

## 🚀 Quick Migration Steps

### 1. Backup First! ⚠️
Before anything else, **backup your Supabase database**:
- Go to your Supabase Dashboard
- Database → Backups
- Create a manual backup

### 2. Run the Migration SQL

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `enable-multi-tenant.sql` from this project
4. Copy all contents (it's a large file with ~900 lines)
5. Paste into the SQL Editor
6. Click **Run**

The migration will:
- ✅ Create `tenants` and `user_tenants` tables
- ✅ Add `tenant_id` to all data tables
- ✅ Create "Default Organization" tenant
- ✅ Assign all existing users to default tenant
- ✅ Assign all existing data to default tenant
- ✅ Update Row Level Security (RLS) policies
- ✅ Create helper functions

### 3. Verify Migration

Run these queries in SQL Editor to verify:

```sql
-- Check default tenant exists
SELECT * FROM tenants WHERE slug = 'default';

-- Check your user is assigned to tenant
SELECT * FROM user_tenants;

-- Check data has tenant_id
SELECT COUNT(*), tenant_id FROM products GROUP BY tenant_id;
```

### 4. Deploy Application

The React application already includes:
- ✅ TenantContext added to App.tsx
- ✅ TenantProvider wrapping routes
- ✅ Tenant service for API calls
- ✅ TypeScript types for Tenant

Just deploy as usual:
```bash
npm run build
# or deploy to Vercel
```

## 📖 What Changed?

### Database
- Every data table now has `tenant_id` column
- New tables: `tenants`, `user_tenants`
- RLS policies now enforce tenant isolation
- Triggers auto-set `tenant_id` on INSERT

### Application
- New `TenantContext` manages current tenant
- New `tenantService` for tenant operations
- TenantProvider added to App.tsx provider tree
- TenantSelector component available (optional to add to header)

### Security
- Complete data isolation at database level via RLS
- Users can only see/modify their tenant's data
- Automatic tenant assignment on record creation

## 🎯 Using the System

### For Existing Users
Nothing changes! All existing:
- Users → Assigned to "Default Organization"
- Data → Belongs to "Default Organization"
- Functionality → Works exactly as before

### For New Tenants

**Option 1: Create via SQL**
```sql
INSERT INTO tenants (name, slug, is_active)
VALUES ('ACME Corp', 'acme-corp', true);
```

**Option 2: Create via TypeScript**
```typescript
import { tenantService } from './services/tenantService';

const newTenant = await tenantService.create({
    name: "ACME Corp",
    slug: "acme-corp",
    email: "contact@acme.com",
    is_active: true,
    subscription_status: 'active'
});
```

**Option 3: During Registration**
Users can create a new tenant when registering:
```typescript
await supabase.auth.signUp({
    email: 'user@example.com',
    password: 'password',
    options: {
        data: {
            full_name: 'John Doe',
            company_name: 'New Company'  // Creates new tenant
        }
    }
});
```

### Adding TenantSelector to Header (Optional)

Edit `src/components/layout/Header.tsx`:

```typescript
import TenantSelector from './TenantSelector';

// In your Header component JSX, add:
<TenantSelector />
```

This shows a dropdown when users belong to multiple tenants.

## 📚 Documentation

See `MULTI_TENANT_GUIDE.md` for comprehensive documentation including:
- Detailed architecture explanation
- Security features
- Best practices
- Troubleshooting
- Future enhancements

## 🧪 Testing

### Test Data Isolation

1. Create two test tenants:
```sql
INSERT INTO tenants (name, slug, is_active) VALUES
('Test Tenant A', 'test-a', true),
('Test Tenant B', 'test-b', true);
```

2. Create test users and assign to different tenants:
```sql
-- Assuming you have user IDs
INSERT INTO user_tenants (user_id, tenant_id, role) VALUES
('user-a-id', (SELECT id FROM tenants WHERE slug = 'test-a'), 'admin'),
('user-b-id', (SELECT id FROM tenants WHERE slug = 'test-b'), 'admin');
```

3. Login as User A, create products
4. Login as User B, verify you can't see User A's products

## ⚙️ Configuration

### Enable NOT NULL Constraints (Recommended After Testing)

After verifying everything works, edit `enable-multi-tenant.sql` and uncomment the ALTER TABLE statements at the end (around line 880):

```sql
ALTER TABLE categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE brands ALTER COLUMN tenant_id SET NOT NULL;
-- etc...
```

Then run those specific statements in SQL Editor.

## 🆘 Troubleshooting

### Can't See Any Data
- Check: Is user assigned to a tenant in `user_tenants`?
- Check: Does the data have `tenant_id` set?
- Run: `SELECT * FROM user_tenants WHERE user_id = auth.uid();`

### Can't Create Records
- Check: Is `auto_set_tenant_id()` trigger working?
- Check: Does user have active tenant association?
- Check: Are RLS policies enabled on the table?

### Wrong Tenant's Data Showing
- Clear browser cache and localStorage
- Re-login to refresh tenant context
- Check: `SELECT get_user_tenant_id();` in SQL Editor

## 📞 Support

For issues:
1. Check Supabase SQL Editor for detailed error messages
2. Review RLS policies in Supabase Dashboard → Authentication → Policies
3. Check browser console for frontend errors
4. Verify tenant associations in database

## 🎉 You're Done!

Your system now supports multiple tenants with complete data isolation. Each organization can:
- Have their own users with different roles
- Maintain separate data (products, orders, customers, etc.)
- Configure their own settings
- Work independently without seeing other tenants' data

All while using the same application instance!
