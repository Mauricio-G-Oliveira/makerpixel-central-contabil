package com.makerpixel.notasync.core.fonte;

import com.makerpixel.notasync.core.codec.LoteCodec;
import com.makerpixel.notasync.core.modelo.*;
import com.makerpixel.notasync.core.regra.MaquinaDeEsperas;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Fonte de captura fiscal para NFC-e (modelo 65) via Secretaria da Fazenda de Santa Catarina (SEF/SC).
 * Implementada conforme o Boletim Técnico SEF/SC 2026/003 v1.00-1.
 * 
 * Serviço: NfceDownload
 * Método: nfceDownloadContab
 * Namespace: http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1
 * Autenticação: mTLS TLS 1.2 com certificado A1 (e-CPF / e-CNPJ) do contabilista
 */
public class SefScNfceFonte implements FonteDeNotas {

    public static final String ID = "sef-sc-nfce";
    public static final String URL_PRODUCAO = "https://dfe.sat.sef.sc.gov.br/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx";

    private final String urlEndpoint;
    private final LoteCodec loteCodec;
    private final MaquinaDeEsperas maquinaDeEsperas;

    public SefScNfceFonte() {
        this(URL_PRODUCAO, new LoteCodec(), new MaquinaDeEsperas());
    }

    public SefScNfceFonte(String urlEndpoint) {
        this(urlEndpoint, new LoteCodec(), new MaquinaDeEsperas());
    }

    public SefScNfceFonte(String urlEndpoint, LoteCodec loteCodec, MaquinaDeEsperas maquinaDeEsperas) {
        this.urlEndpoint = (urlEndpoint != null && !urlEndpoint.isBlank()) ? urlEndpoint : URL_PRODUCAO;
        this.loteCodec = loteCodec != null ? loteCodec : new LoteCodec();
        this.maquinaDeEsperas = maquinaDeEsperas != null ? maquinaDeEsperas : new MaquinaDeEsperas();
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public Set<ModeloDocumento> modelos() {
        return Set.of(ModeloDocumento.NFCE_65);
    }

    @Override
    public TipoCertificado certificadoExigido() {
        return TipoCertificado.CONTADOR;
    }

    @Override
    public ResultadoConsulta consultar(EstadoConsulta estado, Credencial cred) throws FonteException {
        return consultar(estado != null ? estado.toEstadoEmpresa() : null, cred);
    }

    @Override
    public ResultadoConsulta consultar(EstadoEmpresa estado, Credencial cred) throws FonteException {
        if (estado == null || estado.cnpj() == null || estado.cnpj().isBlank()) {
            throw new FonteException(id(), "CNPJ da empresa não informado para consulta");
        }

        try {
            String envelopeSoap = montarEnvelopeDistNfce(estado, cred);
            HttpClient httpClient = criarHttpClient(cred);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(urlEndpoint))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/soap+xml; charset=utf-8")
                    .header("Accept", "application/soap+xml, text/xml")
                    .POST(HttpRequest.BodyPublishers.ofString(envelopeSoap))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400 && response.statusCode() != 500) {
                throw new FonteException(id(), "Erro HTTP retornado pela SEF/SC: " + response.statusCode());
            }

            return processarRespostaSoap(response.body(), estado);

        } catch (FonteException fe) {
            throw fe;
        } catch (Exception e) {
            throw new FonteException(id(), "Falha na comunicação com o web service SEF/SC NFC-e: " + e.getMessage(), e);
        }
    }

    /**
     * Monta o envelope SOAP 1.2 oficial do método nfceDownloadContab.
     * // TODO conferir com o ?WSDL oficial https://dfe.sat.sef.sc.gov.br/nfce/ws/distribuicao/DistribuicaoNfceDownload.asmx?WSDL
     */
    public String montarEnvelopeDistNfce(EstadoEmpresa estado, Credencial cred) {
        String cnpjContador = (cred != null && cred.identificadorTransmissor() != null)
                ? cred.identificadorTransmissor().replaceAll("\\D", "")
                : "";
        if (cnpjContador.length() < 11) {
            // Em testes ou fallback usa o CNPJ da empresa
            cnpjContador = estado.cnpj().replaceAll("\\D", "");
        }

        String cnpjEmpresa = estado.cnpj().replaceAll("\\D", "");
        long ultNuNSU = estado.ultNsu();

        // Pedido distNFCeSC v1.00: UTF-8, sem espaços entre tags, namespace oficial
        String solRel = "<solRel><indXML>1</indXML><indAtor>1</indAtor><ultNuNSU>" + ultNuNSU + "</ultNuNSU></solRel>";
        String distNfceSc = "<distNFCeSC versao=\"1.00\" xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">"
                + "<tpAmb>1</tpAmb><verAplic>notasync 2.1</verAplic><cUF>42</cUF><CNPJ>" + cnpjEmpresa + "</CNPJ>"
                + solRel + "</distNFCeSC>";

        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                + "<soap12:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\">"
                + "<soap12:Body>"
                + "<nfceDownloadContab xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">"
                + "<nfceDadosMsg>" + distNfceSc + "</nfceDadosMsg>"
                + "</nfceDownloadContab>"
                + "</soap12:Body>"
                + "</soap12:Envelope>";
    }

    /**
     * Processa o XML retornado no corpo SOAP pela SEF/SC.
     */
    public ResultadoConsulta processarRespostaSoap(String soapXml, EstadoEmpresa estado) throws Exception {
        if (soapXml == null || soapXml.isBlank()) {
            throw new FonteException(id(), "Resposta SOAP vazia retornada pelo servidor");
        }

        DocumentBuilderFactory dbf = LoteCodec.criarFactorySegura();
        DocumentBuilder db = dbf.newDocumentBuilder();
        Document doc = db.parse(new InputSource(new StringReader(soapXml)));

        int cStat = extrairIntTag(doc, "cStat", 9999);
        String xMotivo = extrairTag(doc, "xMotivo", "Resposta sem xMotivo");
        long ultNuNSURet = extrairLongTag(doc, "ultNuNSURet", estado != null ? estado.ultNsu() : 0L);
        int qtDfeRet = extrairIntTag(doc, "qtDfeRet", 0);
        String loteDistComp = extrairTag(doc, "loteDistComp", null);

        List<Documento> documentos = new ArrayList<>();
        List<String> xmlsBrutos = new ArrayList<>();

        if (loteDistComp != null && !loteDistComp.isBlank()) {
            List<LoteCodec.ItemLote> itens = loteCodec.desempacotarLote(loteDistComp, id());
            for (LoteCodec.ItemLote item : itens) {
                documentos.add(item.documento());
                xmlsBrutos.add(item.xmlBruto());
            }
        }

        int qtdRet = Math.max(qtDfeRet, documentos.size());
        AcaoConsumo acao = maquinaDeEsperas.decidirProximaAcao(cStat, qtdRet, estado, Instant.now());

        return new ResultadoConsulta(
                cStat,
                xMotivo,
                ultNuNSURet,
                qtdRet,
                documentos,
                xmlsBrutos,
                acao
        );
    }

    /**
     * Cria cliente HTTP Java com suporte a mTLS TLS 1.2 caso um certificado PKCS12 seja fornecido.
     */
    protected HttpClient criarHttpClient(Credencial cred) throws Exception {
        HttpClient.Builder builder = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(30));

        if (cred != null && cred.caminhoCertificado() != null && Files.exists(cred.caminhoCertificado())) {
            SSLContext sslContext = criarSslContextMtls(cred.caminhoCertificado(), cred.senhaCertificado());
            builder.sslContext(sslContext);
        }

        return builder.build();
    }

    /**
     * Monta o SSLContext TLS 1.2 com mTLS a partir do arquivo PKCS12 do certificado A1.
     */
    public static SSLContext criarSslContextMtls(Path pfxPath, String senha) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        char[] passwordChars = (senha != null) ? senha.toCharArray() : new char[0];
        try (InputStream is = new FileInputStream(pfxPath.toFile())) {
            keyStore.load(is, passwordChars);
        }

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keyStore, passwordChars);

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        tmf.init((KeyStore) null); // Utiliza a truststore padrão da JVM para validar a SEF/SC

        SSLContext sslContext = SSLContext.getInstance("TLSv1.2");
        sslContext.init(kmf.getKeyManagers(), tmf.getTrustManagers(), new SecureRandom());
        return sslContext;
    }

    private String extrairTag(Document doc, String nomeTag, String padrao) {
        NodeList nl = doc.getElementsByTagNameNS("*", nomeTag);
        if (nl.getLength() == 0) {
            nl = doc.getElementsByTagName(nomeTag);
        }
        if (nl.getLength() > 0) {
            return nl.item(0).getTextContent().trim();
        }
        return padrao;
    }

    private int extrairIntTag(Document doc, String nomeTag, int padrao) {
        String val = extrairTag(doc, nomeTag, null);
        if (val != null) {
            try {
                return Integer.parseInt(val);
            } catch (Exception ignored) {}
        }
        return padrao;
    }

    private long extrairLongTag(Document doc, String nomeTag, long padrao) {
        String val = extrairTag(doc, nomeTag, null);
        if (val != null) {
            try {
                return Long.parseLong(val);
            } catch (Exception ignored) {}
        }
        return padrao;
    }
}
