package com.makerpixel.notasync.app;

import com.makerpixel.notasync.app.domain.DocumentoEntity;
import com.makerpixel.notasync.app.domain.EmpresaEntity;
import com.makerpixel.notasync.app.domain.ExecucaoEntity;
import com.makerpixel.notasync.app.repository.DocumentoRepository;
import com.makerpixel.notasync.app.repository.EmpresaRepository;
import com.makerpixel.notasync.app.repository.ExecucaoRepository;
import com.makerpixel.notasync.app.service.ColetorService;
import com.makerpixel.notasync.simulador.SimuladorApplication;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = NotasyncAppApplication.class)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "notasync.modo=simulador",
        "notasync.sef.url=http://localhost:8089/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx",
        "notasync.saida=./target/test-xml-saida",
        "spring.datasource.url=jdbc:h2:mem:notasync_test;DB_CLOSE_DELAY=-1"
})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class NotasyncIntegrationTest {

    private static ConfigurableApplicationContext simuladorContext;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ColetorService coletorService;

    @Autowired
    private EmpresaRepository empresaRepository;

    @Autowired
    private DocumentoRepository documentoRepository;

    @Autowired
    private ExecucaoRepository execucaoRepository;

    @BeforeAll
    static void iniciarSimulador() {
        simuladorContext = SpringApplication.run(SimuladorApplication.class, "--server.port=8089");
    }

    @AfterAll
    static void encerrarSimulador() {
        if (simuladorContext != null && simuladorContext.isActive()) {
            simuladorContext.close();
        }
        // Limpa pasta temporária de XMLs de teste
        try {
            Path testDir = Paths.get("./target/test-xml-saida");
            if (Files.exists(testDir)) {
                Files.walk(testDir)
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
            }
        } catch (Exception ignored) {}
    }

    @Test
    @Order(1)
    @DisplayName("1. Endpoint /status deve retornar agente operacional em modo simulador")
    void deveRetornarStatusOperacional() throws Exception {
        mockMvc.perform(get("/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPERACIONAL"))
                .andExpect(jsonPath("$.modo").value("simulador"))
                .andExpect(jsonPath("$.agente").value("NotaSync"));
    }

    @Test
    @Order(2)
    @DisplayName("2. Sincronizar Empresa 1 (Mercado Modelo) deve baixar lote de 50 notas, gravar XMLs e atualizar NSU")
    void deveSincronizarEmpresa1ComLoteCheio() {
        String cnpj = "11222333000181";
        EmpresaEntity emp = new EmpresaEntity(cnpj, "Mercado Modelo Ltda");
        empresaRepository.save(emp);

        ColetorService.ResumoColeta resumo = coletorService.sincronizarEmpresa(cnpj, true);

        assertThat(resumo.cStat()).isEqualTo(118);
        assertThat(resumo.qtdDocumentos()).isEqualTo(50);
        assertThat(resumo.ultNsu()).isEqualTo(50L);

        List<DocumentoEntity> docs = documentoRepository.findByCnpjEmitenteOrderByDataEmissaoDesc(cnpj);
        assertThat(docs).hasSize(50);

        // Confere gravação de arquivos XML em disco
        Path pastaEmpresa = Paths.get("./target/test-xml-saida", cnpj);
        assertThat(Files.exists(pastaEmpresa)).isTrue();
    }

    @Test
    @Order(3)
    @DisplayName("3. Sincronizar Empresa 2 (Padaria Central) deve baixar 35 notas incluindo notas canceladas")
    void deveSincronizarEmpresa2ComNotasCanceladas() {
        String cnpj = "44555666000177";
        EmpresaEntity emp = new EmpresaEntity(cnpj, "Padaria & Confeitaria Central Ltda");
        empresaRepository.save(emp);

        ColetorService.ResumoColeta resumo = coletorService.sincronizarEmpresa(cnpj, true);

        assertThat(resumo.cStat()).isEqualTo(118);
        assertThat(resumo.qtdDocumentos()).isEqualTo(35);
        assertThat(resumo.ultNsu()).isEqualTo(35L);

        List<DocumentoEntity> docs = documentoRepository.findByCnpjEmitenteOrderByDataEmissaoDesc(cnpj);
        assertThat(docs).hasSize(35);

        // Confere notas canceladas
        long qtdCanceladas = docs.stream().filter(d -> "CANCELADA".equals(d.getSituacao())).count();
        assertThat(qtdCanceladas).isGreaterThan(0);
    }

    @Test
    @Order(4)
    @DisplayName("4. Sincronizar Empresa 3 (Farmácia Exemplo) deve baixar 15 notas e sincronizar com sucesso")
    void deveSincronizarEmpresa3ComSucesso() {
        String cnpj = "77888999000155";
        EmpresaEntity emp = new EmpresaEntity(cnpj, "Farmácia Exemplo Ltda");
        empresaRepository.save(emp);

        ColetorService.ResumoColeta resumo = coletorService.sincronizarEmpresa(cnpj, true);

        assertThat(resumo.cStat()).isEqualTo(118);
        assertThat(resumo.qtdDocumentos()).isEqualTo(15);
        assertThat(resumo.ultNsu()).isEqualTo(15L);
    }

    @Test
    @Order(5)
    @DisplayName("5. CNPJ sem vínculo SAT (Posto Exemplo Ltda) deve retornar erro 8002 traduzido")
    void deveRetornarErro8002ParaEmpresaSemVinculoSat() {
        String cnpj = "12345678000195"; // CNPJ oficial de teste sem vínculo
        EmpresaEntity emp = new EmpresaEntity(cnpj, "Posto Exemplo Ltda");
        empresaRepository.save(emp);

        ColetorService.ResumoColeta resumo = coletorService.sincronizarEmpresa(cnpj, true);

        assertThat(resumo.cStat()).isEqualTo(8002);
        assertThat(resumo.status()).isEqualTo("PENDENTE_VINCULO_SAT");
        assertThat(resumo.xMotivo()).contains("SAT da SEF/SC");
    }

    @Test
    @Order(6)
    @DisplayName("6. Chamada POST /buscar-agora/{cnpj} durante período de espera deve retornar HTTP 429 Too Many Requests")
    void deveRetornar429DuranteJanelaDeEspera() throws Exception {
        // A Empresa 3 (77888999000155) acabou de sincronizar seu lote parcial de 15 notas e entrou em espera de 12 horas
        String cnpj = "77888999000155";

        mockMvc.perform(post("/buscar-agora/" + cnpj))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.erro").value("Consulta antes do prazo regulamentar da SEF/SC"))
                .andExpect(jsonPath("$.cnpj").value(cnpj))
                .andExpect(jsonPath("$.permitidoAPartirDe").exists())
                .andExpect(jsonPath("$.esperaSegundos").isNumber());
    }

    @Test
    @Order(7)
    @DisplayName("7. Endpoint GET /documentos deve permitir consulta filtrada")
    void deveConsultarDocumentosViaRest() throws Exception {
        mockMvc.perform(get("/documentos").param("cnpj", "11222333000181"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(50));
    }
}
