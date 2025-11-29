// Carregar variáveis de ambiente (incluindo .env.local) antes de tudo
import "./env";

import sql from "./db";

async function testConnection() {
  console.log("🔌 Testando conexão com o banco de dados...\n");

  try {
    // Teste 1: Conexão básica
    console.log("1️⃣ Testando conexão básica...");
    const result =
      await sql`SELECT NOW() as current_time, version() as pg_version`;
    if (result[0]) {
      console.log("✅ Conexão estabelecida com sucesso!");
      console.log(`   Hora atual do servidor: ${result[0].current_time}`);
      const versionParts = result[0].pg_version?.split(" ") || [];
      console.log(
        `   Versão PostgreSQL: ${versionParts[0]} ${versionParts[1] || ""}\n`
      );
    } else {
      throw new Error("Nenhum resultado retornado da query");
    }

    // Teste 2: Verificar se as tabelas existem
    console.log("2️⃣ Verificando se as tabelas existem...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('topics', 'topic_items', 'topic_shares')
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log(
        "❌ Nenhuma tabela encontrada! Execute a migration primeiro."
      );
      return;
    }

    console.log(`✅ Tabelas encontradas: ${tables.length}`);
    tables.forEach((table) => {
      console.log(`   - ${table.table_name}`);
    });
    console.log();

    // Teste 3: Verificar estrutura da tabela topics
    console.log("3️⃣ Verificando estrutura da tabela 'topics'...");
    const topicsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'topics'
      ORDER BY ordinal_position
    `;
    console.log(`✅ Colunas encontradas: ${topicsColumns.length}`);
    topicsColumns.forEach((col) => {
      console.log(
        `   - ${col.column_name} (${col.data_type}) ${
          col.is_nullable === "YES" ? "[NULL]" : "[NOT NULL]"
        }`
      );
    });
    console.log();

    // Teste 4: Verificar RLS
    console.log("4️⃣ Verificando Row Level Security (RLS)...");
    const rlsStatus = await sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('topics', 'topic_items', 'topic_shares')
      ORDER BY tablename
    `;
    console.log(`✅ Status RLS:`);
    rlsStatus.forEach((table) => {
      console.log(
        `   - ${table.tablename}: ${
          table.rowsecurity ? "✅ Habilitado" : "❌ Desabilitado"
        }`
      );
    });
    console.log();

    // Teste 5: Contar registros
    console.log("5️⃣ Contando registros nas tabelas...");
    try {
      const topicsCount = await sql`SELECT COUNT(*) as count FROM topics`;
      const itemsCount = await sql`SELECT COUNT(*) as count FROM topic_items`;
      const sharesCount = await sql`SELECT COUNT(*) as count FROM topic_shares`;

      console.log(`✅ Registros encontrados:`);
      console.log(`   - topics: ${topicsCount[0]?.count || 0}`);
      console.log(`   - topic_items: ${itemsCount[0]?.count || 0}`);
      console.log(`   - topic_shares: ${sharesCount[0]?.count || 0}`);
    } catch (error: any) {
      console.log(`⚠️  Erro ao contar registros: ${error.message}`);
      console.log("   (Isso pode ser normal se o RLS estiver bloqueando)");
    }
    console.log();

    // Teste 6: Testar query de tópicos
    console.log("6️⃣ Testando query de tópicos...");
    try {
      const topics =
        await sql`SELECT id, title, user_id, created_at FROM topics LIMIT 5`;
      console.log(`✅ Query executada com sucesso!`);
      if (topics.length > 0) {
        console.log(`   Encontrados ${topics.length} tópico(s):`);
        topics.forEach((topic) => {
          console.log(`   - ${topic.title} (ID: ${topic.id})`);
        });
      } else {
        console.log("   Nenhum tópico encontrado (tabela vazia)");
      }
    } catch (error: any) {
      console.log(`❌ Erro ao executar query: ${error.message}`);
      console.log(
        "   Verifique as políticas RLS se estiver usando Supabase Auth"
      );
    }
    console.log();

    console.log("🎉 Todos os testes concluídos!");
    console.log(
      "\n💡 Dica: Se você estiver usando Supabase Auth, certifique-se de:"
    );
    console.log("   - Configurar o token JWT nas requisições");
    console.log("   - Verificar se auth.uid() está funcionando corretamente");
  } catch (error: any) {
    console.error("❌ Erro ao testar conexão:", error.message);
    console.error("\n🔍 Verifique:");
    console.error("   1. Se a variável DATABASE_URL está configurada no .env");
    console.error("   2. Se a connection string está correta");
    console.error("   3. Se o Supabase está acessível");
    console.error("   4. Se a migration foi executada");
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testConnection();
