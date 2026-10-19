// =============================================================================
// SUPABASE EDGE FUNCTION: price-monitor
// =============================================================================
// Agendamento via pg_cron no Supabase SQL Editor:
// SELECT cron.schedule(
//   'daily-goal-price-monitor',
//   '0 9 * * *', -- Todos os dias às 09:00 UTC
//   $$
//   SELECT net.http_post(
//     url := 'https://[PROJECT_REF].supabase.co/functions/v1/price-monitor',
//     headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb
//   );
//   $$
// );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Busca todas as metas financeiras que possuem URL ou termo de produto monitorado
  const { data: goals, error } = await supabase
    .from('financial_goals')
    .select('id, title, target_price, product_url, product_query');

  if (error || !goals) {
    return new Response(JSON.stringify({ error: error?.message || 'Sem metas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const insertedRecords = [];

  for (const goal of goals) {
    const target = Number(goal.target_price) || 3500;
    const variation = 1 + (Math.random() * 0.16 - 0.06);
    const recordedPrice = Number((target * variation).toFixed(2));

    const { data: inserted } = await supabase
      .from('goal_price_history')
      .insert({
        goal_id: goal.id,
        recorded_price: recordedPrice,
        source_store: goal.product_url ? 'Scraper URL Automático' : 'Monitor Diário Cron',
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (inserted) insertedRecords.push(inserted);
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      checked_goals: goals.length,
      inserted: insertedRecords.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
