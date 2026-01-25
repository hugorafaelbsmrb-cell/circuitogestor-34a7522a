import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface RequestBody {
  student_id: string;
  items: CartItem[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { student_id, items } = body;

    if (!student_id || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'student_id and items are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate week reference (Monday of current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    const weekReference = weekStart.toISOString().split('T')[0];

    // Insert consumption records
    const consumptions = items.map(item => ({
      student_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      week_reference: weekReference,
      consumed_at: new Date().toISOString()
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('canteen_consumptions')
      .insert(consumptions)
      .select();

    if (insertError) {
      console.error('Error inserting consumptions:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to register consumptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalValue = items.reduce((sum, item) => sum + item.total_price, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Consumptions registered successfully',
        student_name: student.name,
        total_value: totalValue,
        items_count: items.reduce((sum, item) => sum + item.quantity, 0)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
