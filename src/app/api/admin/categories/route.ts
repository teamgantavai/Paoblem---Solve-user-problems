import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, logAdminAction } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const FALLBACK_CATEGORIES = [
  'AI', 'SaaS', 'Education', 'Healthcare', 'Fintech', 'Developer Tools', 
  'Design', 'Marketing', 'Product', 'Sales', 'Operations', 'Funding'
];

// GET list of categories
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    
    // Attempt to query categories from database
    const { data: dbCategories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      if (error.message.includes('relation "public.categories" does not exist')) {
        // Fallback to static list if database table not created yet
        const mappedFallback = FALLBACK_CATEGORIES.map((cat, idx) => ({
          id: `fallback-${idx}`,
          name: cat,
          disabled: false,
          sort_order: idx + 1,
          is_fallback: true,
        }));
        return NextResponse.json({
          categories: mappedFallback,
          migrationsRequired: true,
          message: 'Categories table is missing. Using static fallback list.',
        });
      }
      throw error;
    }

    return NextResponse.json({
      categories: dbCategories || [],
      migrationsRequired: false,
    });
  } catch (err: any) {
    console.error('[Admin Categories API] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Access Denied' }, { status: 403 });
  }
}

// POST actions for categories (create, edit, delete, toggle_disable, merge, reorder)
export async function POST(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    let result: any = null;

    switch (action) {
      case 'create':
        const { name: newName, sort_order: newOrder } = payload || {};
        if (!newName) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        
        result = await supabaseAdmin
          .from('categories')
          .insert({
            name: newName.trim(),
            sort_order: newOrder || 0,
            disabled: false,
          });

        await logAdminAction(admin.id, 'create_category', 'category', newName);
        break;

      case 'edit':
        const { id: editId, name: editName } = payload || {};
        if (!editId || !editName) return NextResponse.json({ error: 'id and name are required' }, { status: 400 });

        result = await supabaseAdmin
          .from('categories')
          .update({ name: editName.trim() })
          .eq('id', editId);

        await logAdminAction(admin.id, 'edit_category', 'category', editId, { name: editName });
        break;

      case 'delete':
        const { id: delId, name: delName } = payload || {};
        if (!delId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        result = await supabaseAdmin
          .from('categories')
          .delete()
          .eq('id', delId);

        await logAdminAction(admin.id, 'delete_category', 'category', delId, { name: delName });
        break;

      case 'toggle_disable':
        const { id: toggleId, disabled: nextDisabled } = payload || {};
        if (!toggleId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        result = await supabaseAdmin
          .from('categories')
          .update({ disabled: !!nextDisabled })
          .eq('id', toggleId);

        await logAdminAction(admin.id, 'toggle_category_status', 'category', toggleId, { disabled: !!nextDisabled });
        break;

      case 'reorder':
        const { orders } = payload || {}; // expects array of { id, sort_order }
        if (!orders || !Array.isArray(orders)) return NextResponse.json({ error: 'orders array is required' }, { status: 400 });

        for (const item of orders) {
          await supabaseAdmin
            .from('categories')
            .update({ sort_order: item.sort_order })
            .eq('id', item.id);
        }

        await logAdminAction(admin.id, 'reorder_categories', 'category', 'all');
        return NextResponse.json({ success: true, message: 'Reordered categories successfully' });

      case 'merge':
        const { sourceName, targetName, deleteSourceId } = payload || {};
        if (!sourceName || !targetName) {
          return NextResponse.json({ error: 'sourceName and targetName are required' }, { status: 400 });
        }

        // 1. Update posts: relocate from source category name to target category name
        const { error: updatePostErr } = await supabaseAdmin
          .from('posts')
          .update({ category: targetName })
          .eq('category', sourceName);

        if (updatePostErr) throw updatePostErr;

        // 2. Remove source category from table if requested
        if (deleteSourceId) {
          await supabaseAdmin
            .from('categories')
            .delete()
            .eq('id', deleteSourceId);
        }

        await logAdminAction(admin.id, 'merge_categories', 'category', sourceName, { target: targetName });
        return NextResponse.json({ success: true, message: `Successfully merged '${sourceName}' into '${targetName}'` });

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if (result && result.error) {
      throw result.error;
    }

    return NextResponse.json({ success: true, message: 'Action completed successfully' });
  } catch (err: any) {
    console.error('[Admin Categories Action API] Error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
