import postgres from 'postgres';

async function initDB() {
  console.log('🔌 Connecting to default "postgres" database...');
  // Connect to default 'postgres' db to create the new db
  const sqlAdmin = postgres('postgres://postgres:postgres@localhost:5432/postgres');

  try {
    console.log('🔨 Creating database "momu"...');
    await sqlAdmin`CREATE DATABASE momu`;
    console.log('✅ Database "momu" created!');
  } catch (e: any) {
    if (e.code === '42P04') {
      console.log('ℹ️ Database "momu" already exists.');
    } else {
      console.error('❌ Error creating database:', e);
      // If we can't create the DB, we might not be able to proceed with table creation unless it already exists
      // But let's try to proceed assuming it might exist or we can't do anything else
    }
  } finally {
    await sqlAdmin.end();
  }

  // Now connect to the 'momu' database
  console.log('🔌 Connecting to "momu" database...');
  const sql = postgres('postgres://postgres:postgres@localhost:5432/momu');

  try {
    console.log('🔨 Creating tables...');

    // Topics Table
    await sql`
      CREATE TABLE IF NOT EXISTS topics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        cover_color TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ Table "topics" ready.');

    // Topic Items Table
    await sql`
      CREATE TABLE IF NOT EXISTS topic_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES topic_items(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        youtube_url TEXT,
        youtube_id TEXT,
        duration_seconds INTEGER,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP WITH TIME ZONE,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('✅ Table "topic_items" ready.');

    // Seed some data if empty
    const count = await sql`SELECT count(*) FROM topics`;
    if (count[0].count === '0') {
        console.log('🌱 Seeding initial data...');
        
        // Create first topic: Teclado Gospel
        const topic1 = await sql`
            INSERT INTO topics (title, description, user_id, is_public)
            VALUES ('Teclado Gospel 2026', 'Aprenda teclado do zero ao avançado com foco em músicas gospel.', '00000000-0000-0000-0000-000000000000', true)
            RETURNING id
        `;
        const topicId1 = topic1[0].id;

        await sql`
            INSERT INTO topic_items (topic_id, type, title, content, youtube_url, youtube_id, order_index)
            VALUES 
            (${topicId1}, 'section', 'Módulo 1: Fundamentos', 'Aprenda os conceitos básicos do teclado', null, null, 1),
            (${topicId1}, 'video', 'Aula 1: Conhecendo o Teclado', 'Entendendo as teclas, oitavas e posicionamento das mãos.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 2),
            (${topicId1}, 'note', 'Dica Importante', 'Sempre aqueça as mãos antes de tocar para evitar lesões.', null, null, 3),
            (${topicId1}, 'task', 'Praticar Dó Maior', 'Fazer a escala de Dó Maior 10 vezes por dia durante uma semana.', null, null, 4),
            (${topicId1}, 'section', 'Módulo 2: Acordes Básicos', 'Aprenda os acordes fundamentais', null, null, 5),
            (${topicId1}, 'video', 'Aula 2: Acordes Maiores', 'Como formar e tocar acordes maiores.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 6)
        `;
        
        // Create second topic: Inglês Fluente
        const topic2 = await sql`
            INSERT INTO topics (title, description, user_id, is_public)
            VALUES ('Inglês Fluente 2026', 'Do zero ao avançado em inglês com método comprovado.', '00000000-0000-0000-0000-000000000000', true)
            RETURNING id
        `;
        const topicId2 = topic2[0].id;

        await sql`
            INSERT INTO topic_items (topic_id, type, title, content, youtube_url, youtube_id, order_index)
            VALUES 
            (${topicId2}, 'section', 'Semana 1: Básico', 'Fundamentos da língua inglesa', null, null, 1),
            (${topicId2}, 'video', 'Alfabeto e Pronúncia', 'Aprenda a pronúncia correta do alfabeto.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ', 2),
            (${topicId2}, 'task', 'Memorizar 50 palavras', 'Estude as 50 palavras mais comuns em inglês.', null, null, 3)
        `;
        
        console.log('✅ Seed data created.');
    }

  } catch (e) {
    console.error('❌ Error initializing tables:', e);
  } finally {
    await sql.end();
  }
}

initDB();
