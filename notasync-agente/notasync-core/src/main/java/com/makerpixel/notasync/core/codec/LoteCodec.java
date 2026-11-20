package com.makerpixel.notasync.core.codec;

import com.makerpixel.notasync.core.modelo.ChaveAcesso;
import com.makerpixel.notasync.core.modelo.Documento;
import com.makerpixel.notasync.core.modelo.ModeloDocumento;
import com.makerpixel.notasync.core.modelo.SituacaoDocumento;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Codec seguro para empacotamento e desempacotamento de lotes compactados da SEF/SC (loteDistComp: GZIP + Base64 + XML).
 * Protegido contra ataques de XML External Entity (XXE) e Billion Laughs.
 */
public class LoteCodec {

    public record ItemLote(
            Documento documento,
            String xmlBruto
    ) {}

    /**
     * Cria uma fábrica de DocumentBuilder segura com XXE rigorosamente desabilitado.
     */
    public static DocumentBuilderFactory criarFactorySegura() {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        try {
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
            dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setXIncludeAware(false);
            dbf.setExpandEntityReferences(false);
        } catch (Exception ignored) {
            // Recursos opcionais dependendo do parser subjacente
        }
        return dbf;
    }

    /**
     * Decodifica o base64, descomprime o gzip e extrai todos os documentos fiscais e XMLs brutos.
     */
    public List<ItemLote> desempacotarLote(String loteDistCompBase64, String fonteId) throws Exception {
        if (loteDistCompBase64 == null || loteDistCompBase64.isBlank()) {
            return List.of();
        }

        byte[] compressedBytes = Base64.getDecoder().decode(loteDistCompBase64.trim().replaceAll("\\s+", ""));
        String xmlDescompactado;

        try (GZIPInputStream gzis = new GZIPInputStream(new ByteArrayInputStream(compressedBytes));
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            gzis.transferTo(baos);
            xmlDescompactado = baos.toString(StandardCharsets.UTF_8);
        }

        DocumentBuilderFactory dbf = criarFactorySegura();
        DocumentBuilder db = dbf.newDocumentBuilder();
        Document doc = db.parse(new InputSource(new StringReader(xmlDescompactado)));

        NodeList itensNodeList = doc.getElementsByTagNameNS("*", "distNFCeSC");
        if (itensNodeList.getLength() == 0) {
            itensNodeList = doc.getElementsByTagName("distNFCeSC");
        }

        List<ItemLote> resultado = new ArrayList<>();
        TransformerFactory tf = TransformerFactory.newInstance();
        try {
            tf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        } catch (Exception ignored) {}

        for (int i = 0; i < itensNodeList.getLength(); i++) {
            Element elem = (Element) itensNodeList.item(i);
            String nsuStr = elem.getAttribute("NSU");
            String chAcesso = elem.getAttribute("chAcesso");

            long nsu = (nsuStr != null && !nsuStr.isBlank()) ? Long.parseLong(nsuStr) : 0L;

            // Extrai o XML individual em String
            Transformer transformer = tf.newTransformer();
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
            transformer.setOutputProperty(OutputKeys.INDENT, "no");
            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(elem), new StreamResult(writer));
            String xmlIndividual = writer.toString();

            boolean ehCancelamento = xmlIndividual.contains("procEventoNFe")
                    || xmlIndividual.contains("110111")
                    || xmlIndividual.contains("110112");

            String vNfStr = extrairTag(elem, "vNF");
            BigDecimal valorTotal = BigDecimal.ZERO;
            if (vNfStr != null && !vNfStr.isBlank()) {
                try {
                    valorTotal = new BigDecimal(vNfStr);
                } catch (Exception ignored) {}
            }

            String dhEmiStr = extrairTag(elem, "dhEmi");
            Instant dataEmissao = Instant.now();
            if (dhEmiStr != null && !dhEmiStr.isBlank()) {
                try {
                    dataEmissao = Instant.parse(dhEmiStr);
                } catch (DateTimeParseException e) {
                    try {
                        dataEmissao = java.time.OffsetDateTime.parse(dhEmiStr).toInstant();
                    } catch (Exception ignored) {}
                }
            }

            String cnpjEmitente = extrairTag(elem, "CNPJ");
            if (cnpjEmitente == null || cnpjEmitente.isBlank()) {
                if (chAcesso != null && chAcesso.length() == 44) {
                    cnpjEmitente = chAcesso.substring(6, 20);
                }
            }

            ModeloDocumento modelo = ModeloDocumento.NFCE_65;
            if (chAcesso != null && chAcesso.length() == 44) {
                try {
                    ChaveAcesso chaveParsed = ChaveAcesso.parse(chAcesso);
                    modelo = chaveParsed.modelo();
                    if (cnpjEmitente == null || cnpjEmitente.isBlank()) {
                        cnpjEmitente = chaveParsed.cnpjEmitente();
                    }
                } catch (Exception ignored) {}
            }

            SituacaoDocumento situacao = ehCancelamento ? SituacaoDocumento.CANCELADA : SituacaoDocumento.AUTORIZADA;
            String motivoCancelamento = ehCancelamento ? "Cancelamento homologado na SEF/SC" : null;

            Documento documento = new Documento(
                    chAcesso,
                    modelo,
                    cnpjEmitente,
                    dataEmissao,
                    valorTotal,
                    situacao,
                    nsu,
                    fonteId != null ? fonteId : "sef-sc-nfce",
                    null,
                    motivoCancelamento
            );

            resultado.add(new ItemLote(documento, xmlIndividual));
        }

        return resultado;
    }

    /**
     * Compacta uma lista de documentos em gzip + base64 no formato oficial <loteDistNFCeSC>.
     */
    public String empacotarLote(List<Documento> documentos) throws Exception {
        if (documentos == null || documentos.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<loteDistNFCeSC xmlns=\"http://www.satnfce.sef.sc.gov.br/ws/distribuicao-v1\">");

        for (Documento doc : documentos) {
            String ch = doc.chave();
            long nsu = doc.nsu();
            long numero = 1;
            int serie = 1;
            if (ch != null && ch.length() == 44) {
                try {
                    ChaveAcesso parsed = ChaveAcesso.parse(ch);
                    numero = parsed.numero();
                    serie = parsed.serie();
                } catch (Exception ignored) {}
            }

            sb.append("<distNFCeSC NSU=\"").append(nsu).append("\" chAcesso=\"").append(ch).append("\">");
            if (doc.situacao() == SituacaoDocumento.CANCELADA) {
                sb.append("<procEventoNFe versao=\"1.00\"><evento><infEvento><tpEvento>110111</tpEvento><detEvento><descEvento>Cancelamento</descEvento></detEvento></infEvento></evento></procEventoNFe>");
            } else {
                sb.append("<nfeProc versao=\"4.00\"><NFe><infNFe><ide><nNF>")
                        .append(numero)
                        .append("</nNF><serie>")
                        .append(serie)
                        .append("</serie><dhEmi>")
                        .append(doc.dataEmissao() != null ? doc.dataEmissao().toString() : Instant.now().toString())
                        .append("</dhEmi></ide><emit><CNPJ>")
                        .append(doc.cnpjEmitente())
                        .append("</CNPJ></emit><total><ICMSTot><vNF>")
                        .append(doc.valorTotal() != null ? doc.valorTotal().toPlainString() : "0.00")
                        .append("</vNF></ICMSTot></total></infNFe></NFe></nfeProc>");
            }
            sb.append("</distNFCeSC>");
        }

        sb.append("</loteDistNFCeSC>");

        byte[] xmlBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (GZIPOutputStream gzos = new GZIPOutputStream(baos)) {
            gzos.write(xmlBytes);
        }

        return Base64.getEncoder().encodeToString(baos.toByteArray());
    }

    private String extrairTag(Element elem, String nomeTag) {
        NodeList nl = elem.getElementsByTagNameNS("*", nomeTag);
        if (nl.getLength() == 0) {
            nl = elem.getElementsByTagName(nomeTag);
        }
        if (nl.getLength() > 0) {
            return nl.item(0).getTextContent();
        }
        return null;
    }
}
