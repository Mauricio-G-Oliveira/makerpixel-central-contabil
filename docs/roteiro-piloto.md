# Roteiro de Teste de Ponta a Ponta — Piloto Central Contábil v4.0.0

Consulte o documento completo em [makerpixel-gestao-api/docs/roteiro-piloto.md](file:///Users/mauricio/Desktop/gestao%20financeira/makerpixel-gestao-api/docs/roteiro-piloto.md).

## Resumo dos 6 Passos de Validação do Piloto:
1. **Criar Escritório de Teste:** no menu Admin MakerPixel, configurando plano e 30 dias de teste.
2. **Login e Upload de Certificado A1:** no NotaSync, com aceite do Termo de Custódia e envio ao cofre seguro AES-256-GCM.
3. **Buscar Documentos:** importar 3 empresas e executar a sincronização (observando o retorno de notas ou a tradução do cStat 8002).
4. **Download ZIP & Auditoria IBS/CBS:** download em streaming do arquivo ZIP do mês e envio direto para o auditor da Reforma Tributária com exportação Excel.
5. **Em Dia Reescrito:** geração idempotente do mês e verificação de tarefas automáticas (erro SAT 8002, vencimento de certificado e divergências da Reforma).
6. **Suspensão e LGPD:** teste de bloqueio pelo admin e exportação/exclusão de dados em conformidade com a LGPD.
7. **Auditoria Contínua & SIEG (v4.1.0):** entrada contínua de notas fiscais, painel com semáforo por empresa (verde, amarelo e vermelho), resumo "desde ontem", reconferência do mês sob demanda e criação de tarefas no Em Dia.
