import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { QUESTION_BANK } from './questionBank';

async function main() {
  console.log(`Seeding ${QUESTION_BANK.length} questions...`);

  // Idempotent upsert keyed on the question's stable id (e.g. "72H-01").
  const { error } = await supabase.from('questions').upsert(QUESTION_BANK, { onConflict: 'id' });
  if (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }

  const { error: configError } = await supabase
    .from('event_config')
    .upsert(
      {
        id: 1,
        project_name: '72 sata bez kompromisa',
        edition_year: 2026,
        official_project_url: 'https://72h.hr/',
      },
      { onConflict: 'id' }
    );
  if (configError) {
    console.error('Event config seed failed:', configError);
    process.exit(1);
  }

  console.log('Seed complete.');
  process.exit(0);
}

main();
