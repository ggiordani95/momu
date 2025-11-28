import postgres from 'postgres';

async function resetDB() {
  console.log('🔌 Connecting to "momu" database...');
  const sql = postgres('postgres://postgres:postgres@localhost:5432/momu');

  try {
    console.log('🗑️ Clearing existing data...');
    await sql`DELETE FROM topic_items`;
    await sql`DELETE FROM topics`;
    console.log('✅ Data cleared.');

    console.log('🌱 Seeding fresh data...');
    
    // Create first topic: Teclado Gospel
    const topic1 = await sql`
        INSERT INTO topics (title, description, user_id, is_public)
        VALUES ('Teclado Gospel 2026', 'Aprenda teclado do zero ao avançado com foco em músicas gospel.', '00000000-0000-0000-0000-000000000000', true)
        RETURNING id
    `;
    const topicId1 = topic1[0].id;

    // Create Módulo 1 (parent section)
    const modulo1 = await sql`
        INSERT INTO topic_items (topic_id, type, title, content, order_index)
        VALUES (${topicId1}, 'section', 'Módulo 1: Fundamentos', 'Aprenda os conceitos básicos do teclado', 1)
        RETURNING id
    `;
    const modulo1Id = modulo1[0].id;

    // Create children of Módulo 1
    await sql`
        INSERT INTO topic_items (topic_id, parent_id, type, title, content, youtube_url, youtube_id, order_index)
        VALUES 
        (${topicId1}, ${modulo1Id}, 'video', 'Aula 1: Conhecendo o Teclado', 'Entendendo as teclas, oitavas e posicionamento das mãos.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 2),
        (${topicId1}, ${modulo1Id}, 'note', 'Dica Importante', 'Sempre aqueça as mãos antes de tocar para evitar lesões.', null, null, 3),
        (${topicId1}, ${modulo1Id}, 'task', 'Praticar Dó Maior', 'Fazer a escala de Dó Maior 10 vezes por dia durante uma semana.', null, null, 4)
    `;

    // Create Módulo 2 (parent section)
    const modulo2 = await sql`
        INSERT INTO topic_items (topic_id, type, title, content, order_index)
        VALUES (${topicId1}, 'section', 'Módulo 2: Acordes Básicos', 'Aprenda os acordes fundamentais', 5)
        RETURNING id
    `;
    const modulo2Id = modulo2[0].id;

    // Create children of Módulo 2
    await sql`
        INSERT INTO topic_items (topic_id, parent_id, type, title, content, youtube_url, youtube_id, order_index)
        VALUES 
        (${topicId1}, ${modulo2Id}, 'video', 'Aula 2: Acordes Maiores', 'Como formar e tocar acordes maiores.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 6),
        (${topicId1}, ${modulo2Id}, 'task', 'Praticar Acordes C, G, F', 'Pratique a transição entre esses três acordes.', null, null, 7)
    `;
    
    // Create second topic: Inglês Fluente
    const topic2 = await sql`
        INSERT INTO topics (title, description, user_id, is_public)
        VALUES ('Inglês Fluente 2026', 'Do zero ao avançado em inglês com método comprovado.', '00000000-0000-0000-0000-000000000000', true)
        RETURNING id
    `;
    const topicId2 = topic2[0].id;

    // Create Semana 1 (parent section)
    const semana1 = await sql`
        INSERT INTO topic_items (topic_id, type, title, content, order_index)
        VALUES (${topicId2}, 'section', 'Semana 1: Básico', 'Fundamentos da língua inglesa', 1)
        RETURNING id
    `;
    const semana1Id = semana1[0].id;

    // Create children of Semana 1
    await sql`
        INSERT INTO topic_items (topic_id, parent_id, type, title, content, youtube_url, youtube_id, order_index)
        VALUES 
        (${topicId2}, ${semana1Id}, 'video', 'Alfabeto e Pronúncia', 'Aprenda a pronúncia correta do alfabeto.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 2),
        (${topicId2}, ${semana1Id}, 'task', 'Memorizar 50 palavras', 'Estude as 50 palavras mais comuns em inglês.', null, null, 3)
    `;
    
    console.log('✅ Fresh seed data created!');

  } catch (e) {
    console.error('❌ Error resetting database:', e);
  } finally {
    await sql.end();
  }
}

resetDB();
